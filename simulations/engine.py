"""Coupled simulation engine — ties ants, flock, and market together."""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from simulations.ant_colony import AntColonyConfig, AntColonyState
from simulations.flocking import FlockingConfig, FlockingState
from simulations.market import MarketConfig, MarketState
from simulations import metrics as met


@dataclass
class EmergenceEngine:
    ants: AntColonyState = field(default_factory=AntColonyState)
    flock: FlockingState = field(default_factory=FlockingState)
    market: MarketState = field(default_factory=MarketState)

    tick: int = 0
    paused: bool = False
    dt: float = 1.0

    entropy_hist: list[float] = field(default_factory=list)
    emergence_hist: list[float] = field(default_factory=list)
    coupling_strength: float = 0.0

    snapshot_ring: list[dict[str, Any]] = field(default_factory=list)
    max_snapshots: int = 140

    def reset_all(self) -> None:
        self.ants.reset()
        self.flock.reset()
        self.market.reset()
        self.tick = 0
        self.entropy_hist.clear()
        self.emergence_hist.clear()
        self.snapshot_ring.clear()

    def sync_params_from_ui(self, payload: dict[str, Any]) -> None:
        """Apply slider updates without full reset."""
        a = payload.get("ants") or {}
        if "population" in a:
            self.ants.resize_population(int(a["population"]))
        if "evaporation_rate" in a:
            self.ants.cfg.evaporation_rate = float(a["evaporation_rate"])
        if "diffusion_rate" in a:
            self.ants.cfg.diffusion_rate = float(a["diffusion_rate"])
        if "food_sources" in a:
            self.ants.cfg.food_sources = int(a["food_sources"])
            self.ants._seed_food()

        f = payload.get("flock") or {}
        if "population" in f:
            self.flock.resize(int(f["population"]))
        if "vision_radius" in f:
            self.flock.cfg.vision_radius = float(f["vision_radius"])
        if "separation_weight" in f:
            self.flock.cfg.separation_weight = float(f["separation_weight"])
        if "cohesion_weight" in f:
            self.flock.cfg.cohesion_weight = float(f["cohesion_weight"])
        if "predator_speed" in f:
            self.flock.cfg.predator_speed = float(f["predator_speed"])

        m = payload.get("market") or {}
        if any(k in m for k in ("num_buyers", "num_sellers")):
            self.market.resize(int(m.get("num_buyers", self.market.cfg.num_buyers)),
                               int(m.get("num_sellers", self.market.cfg.num_sellers)))
        if "volatility" in m:
            self.market.cfg.volatility = float(m["volatility"])
        if "speculation_rate" in m:
            self.market.cfg.speculation_rate = float(m["speculation_rate"])

    def _coupling_pre_step(self) -> None:
        norm_px = self.market.normalized_price()
        # High market prices -> ants "work harder"
        self.ants.cfg.food_coupling_boost = 0.62 + 0.72 * norm_px

        # Ant foraging throughput lowers prices via supply pressure
        vel = float(self.ants.tick_forage_rate)
        self.market.cfg.supply_pressure = float(np.clip(vel * 2.4, 0.0, 1.6))

        # Flock cohesion influences market sentiment (bullish when cohesive)
        coh = float(self.flock.cohesion_metric)
        sentiment = float(np.clip((coh - 2.8) * 0.07, -0.85, 0.85))
        self.flock.cfg.sentiment_coupling = sentiment * 0.35

    def _coupling_post_flock(self) -> None:
        coh = float(self.flock.cohesion_metric)
        bias = float(np.clip((coh - 3.1) * 0.55, -2.8, 2.8))
        if self.market.buyer_will.size:
            self.market.buyer_will += bias * 0.018 * self.dt

    def step(self) -> dict[str, Any]:
        if self.paused:
            return self.build_payload()

        self._coupling_pre_step()

        self.ants.step(self.dt)
        self.flock.step(self.dt)
        self._coupling_post_flock()
        self.market.step(self.dt)

        self.tick += 1

        antp = self.ants.to_payload()
        flockp = self.flock.to_payload()
        marketp = self.market.to_payload()

        ent_ant = met.shannon_entropy_grid(antp["grid"]["trail"])
        ent_flock = met.shannon_entropy_positions(
            flockp["boids"]["x"], flockp["boids"]["y"], grid=18
        )
        ent_market = met.market_entropy(marketp["order_book"])

        px = self.market.normalized_price()
        vel = float(self.ants.tick_forage_rate)
        coh = float(self.flock.cohesion_metric)
        self.coupling_strength = float(
            0.34 * abs(px - 0.5) + 0.33 * min(1.0, vel * 2.1) + 0.33 * min(1.0, coh / 8.0)
        )

        emergence = met.emergence_index(
            ent_ant, ent_flock, ent_market, self.coupling_strength
        )
        comp = met.complexity_score(
            {
                "entropy_ant": ent_ant / 8.0,
                "entropy_flock": ent_flock / 8.0,
                "entropy_market": ent_market / 8.0,
                "emergence": emergence,
                "coupling": self.coupling_strength,
            }
        )

        agg_entropy = (ent_ant + ent_flock + ent_market) / 3.0
        self.entropy_hist.append(agg_entropy)
        self.entropy_hist = self.entropy_hist[-720:]
        self.emergence_hist.append(emergence)
        self.emergence_hist = self.emergence_hist[-720:]

        phase = met.phase_transition_alert(self.entropy_hist)

        payload = {
            "tick": self.tick,
            "paused": self.paused,
            "ants": antp,
            "flock": flockp,
            "market": marketp,
            "coupling": {
                "strength": self.coupling_strength,
                "market_to_ants": float(self.ants.cfg.food_coupling_boost),
                "ants_to_market_supply": float(self.market.cfg.supply_pressure),
                "flock_to_market_bias": float(self.flock.cfg.sentiment_coupling),
                "price_norm": float(px),
            },
            "metrics": {
                "entropy": {
                    "ants": ent_ant,
                    "flock": ent_flock,
                    "market": ent_market,
                    "aggregate": agg_entropy,
                },
                "emergence_index": emergence,
                "complexity": comp,
                "phase": phase,
                "history": {
                    "entropy": self.entropy_hist[-360:],
                    "emergence": self.emergence_hist[-360:],
                },
            },
        }

        if self.tick % 6 == 0:
            snap_payload = json.loads(json.dumps(payload))
            gw = snap_payload["ants"]["grid"]["w"]
            gh = snap_payload["ants"]["grid"]["h"]
            arr = np.asarray(snap_payload["ants"]["grid"]["trail"], dtype=np.float64).reshape(
                gh, gw
            )
            arr = arr[::3, ::3]
            snap_payload["ants"]["grid"]["trail"] = arr.flatten().tolist()
            snap_payload["ants"]["grid"]["w"] = int(arr.shape[1])
            snap_payload["ants"]["grid"]["h"] = int(arr.shape[0])
            self.snapshot_ring.append(snap_payload)
            if len(self.snapshot_ring) > self.max_snapshots:
                self.snapshot_ring.pop(0)

        return payload

    def build_payload(self) -> dict[str, Any]:
        """Snapshot without advancing physics."""
        antp = self.ants.to_payload()
        flockp = self.flock.to_payload()
        marketp = self.market.to_payload()
        ent_ant = met.shannon_entropy_grid(antp["grid"]["trail"])
        ent_flock = met.shannon_entropy_positions(
            flockp["boids"]["x"], flockp["boids"]["y"], grid=18
        )
        ent_market = met.market_entropy(marketp["order_book"])
        agg_entropy = (ent_ant + ent_flock + ent_market) / 3.0
        emergence = met.emergence_index(
            ent_ant, ent_flock, ent_market, self.coupling_strength
        )
        comp = met.complexity_score(
            {
                "entropy_ant": ent_ant / 8.0,
                "entropy_flock": ent_flock / 8.0,
                "entropy_market": ent_market / 8.0,
                "emergence": emergence,
                "coupling": self.coupling_strength,
            }
        )
        phase = met.phase_transition_alert(self.entropy_hist)
        px = self.market.normalized_price()
        return {
            "tick": self.tick,
            "paused": self.paused,
            "ants": antp,
            "flock": flockp,
            "market": marketp,
            "coupling": {
                "strength": self.coupling_strength,
                "market_to_ants": float(self.ants.cfg.food_coupling_boost),
                "ants_to_market_supply": float(self.market.cfg.supply_pressure),
                "flock_to_market_bias": float(self.flock.cfg.sentiment_coupling),
                "price_norm": float(px),
            },
            "metrics": {
                "entropy": {
                    "ants": ent_ant,
                    "flock": ent_flock,
                    "market": ent_market,
                    "aggregate": agg_entropy,
                },
                "emergence_index": emergence,
                "complexity": comp,
                "phase": phase,
                "history": {
                    "entropy": self.entropy_hist[-360:],
                    "emergence": self.emergence_hist[-360:],
                },
            },
        }
