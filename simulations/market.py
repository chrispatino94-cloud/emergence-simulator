"""Decentralized bid/ask market — price emerges from agent thresholds."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

import numpy as np


@dataclass
class MarketConfig:
    num_buyers: int = 520
    num_sellers: int = 520
    volatility: float = 0.35
    speculation_rate: float = 0.22
    supply_pressure: float = 0.0  # from ants (positive lowers price)


@dataclass
class MarketState:
    cfg: MarketConfig = field(default_factory=MarketConfig)
    buyer_will: np.ndarray = field(init=False)
    seller_ask: np.ndarray = field(init=False)
    price: float = 100.0
    last_returns: list[float] = field(default_factory=list)
    price_history: list[float] = field(default_factory=list)
    tick_volume: float = 0.0
    shock_timer: float = 0.0

    def __post_init__(self) -> None:
        self._init_agents()

    def _init_agents(self) -> None:
        mid = self.price
        nb = max(10, self.cfg.num_buyers)
        ns = max(10, self.cfg.num_sellers)
        self.cfg.num_buyers = nb
        self.cfg.num_sellers = ns
        bw = np.random.normal(0, 4.5, nb).astype(np.float64)
        sa = np.random.normal(0, 4.5, ns).astype(np.float64)
        self.buyer_will = mid + bw
        self.seller_ask = mid + sa

    def reset(self) -> None:
        self.price = 80.0 + random.random() * 40.0
        self.last_returns = []
        self.price_history = []
        self.tick_volume = 0.0
        self.shock_timer = 0.0
        self._init_agents()

    def resize(self, nb: int, ns: int) -> None:
        self.cfg.num_buyers = max(10, min(900, int(nb)))
        self.cfg.num_sellers = max(10, min(900, int(ns)))
        self._init_agents()

    def external_shock(self) -> None:
        self.shock_timer = 140.0

    def step(self, dt: float = 1.0) -> None:
        cfg = self.cfg
        vol = cfg.volatility * (1.35 + 3.2 * (self.shock_timer > 0))
        spec = cfg.speculation_rate
        supply = cfg.supply_pressure

        mid = self.price
        # Drift willingness around current mid + speculation churn
        noise_b = np.random.normal(0, vol * 0.65, self.buyer_will.shape[0])
        noise_s = np.random.normal(0, vol * 0.65, self.seller_ask.shape[0])
        self.buyer_will += noise_b * 0.08 * dt + (mid - self.buyer_will) * spec * 0.004 * dt
        self.seller_ask += noise_s * 0.08 * dt + (mid - self.seller_ask) * spec * 0.004 * dt

        # Supply from ants lowers effective reservation (more goods)
        if abs(supply) > 1e-6:
            self.seller_ask -= supply * 0.045 * dt

        trades = []
        attempts = int(95 + min(420, self.buyer_will.shape[0] // 2))
        for _ in range(attempts):
            i = random.randrange(self.buyer_will.shape[0])
            j = random.randrange(self.seller_ask.shape[0])
            bw = float(self.buyer_will[i])
            sa = float(self.seller_ask[j])
            spread_noise = random.gauss(0, vol * 0.08)
            if bw + spread_noise >= sa:
                trade_px = (bw + sa) * 0.5 + random.gauss(0, vol * 0.05)
                trades.append(trade_px)
                self.buyer_will[i] = bw - random.uniform(0.2, 1.1) * vol
                self.seller_ask[j] = sa + random.uniform(0.2, 1.1) * vol

        if trades:
            new_mid = float(np.mean(trades))
            self.price = self.price * 0.35 + new_mid * 0.65
            self.tick_volume = float(len(trades))
        else:
            # Mean reversion micro noise
            self.price += random.gauss(0, vol * 0.045) * dt
            self.tick_volume = 0.0

        # Shock decay
        if self.shock_timer > 0:
            self.shock_timer -= dt

        ret = (self.price - mid) / (mid + 1e-9)
        self.last_returns.append(ret)
        self.last_returns = self.last_returns[-600:]
        self.price_history.append(self.price)
        self.price_history = self.price_history[-500:]

    def normalized_price(self) -> float:
        """Map recent price range to ~[0,1] for coupling."""
        ph = self.price_history
        if len(ph) < 12:
            return 0.5
        lo = float(min(ph[-400:]))
        hi = float(max(ph[-400:]))
        return float(np.clip((self.price - lo) / (hi - lo + 1e-9), 0.0, 1.0))

    def order_book_payload(self, bins: int = 24) -> dict:
        bw = self.buyer_will
        sa = self.seller_ask
        center = self.price
        window = max(18.0, float(np.std(np.concatenate([bw, sa])) * 2.8 + 4.0))
        lo = center - window
        hi = center + window
        edges = np.linspace(lo, hi, bins + 1)
        bid_hist, _ = np.histogram(bw, bins=edges)
        ask_hist, _ = np.histogram(sa, bins=edges)
        return {
            "bins": bins,
            "lo": float(lo),
            "hi": float(hi),
            "bids": bid_hist.astype(int).tolist(),
            "asks": ask_hist.astype(int).tolist(),
            "mid": float(self.price),
        }

    def to_payload(self) -> dict:
        return {
            "price": float(self.price),
            "volume": float(self.tick_volume),
            "volatility": self.cfg.volatility,
            "speculation_rate": self.cfg.speculation_rate,
            "shock": bool(self.shock_timer > 0),
            "order_book": self.order_book_payload(),
            "params": {
                "num_buyers": self.cfg.num_buyers,
                "num_sellers": self.cfg.num_sellers,
                "volatility": self.cfg.volatility,
                "speculation_rate": self.cfg.speculation_rate,
            },
        }
