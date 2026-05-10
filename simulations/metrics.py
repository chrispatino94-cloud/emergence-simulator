"""Complexity metrics: entropy, emergence proxy, phase-transition hints."""

from __future__ import annotations

import math
from typing import Any

import numpy as np


def _safe_entropy(counts: np.ndarray) -> float:
    total = float(np.sum(counts))
    if total <= 0:
        return 0.0
    p = counts[counts > 0] / total
    return float(-np.sum(p * np.log2(p + 1e-15)))


def shannon_entropy_grid(trail_flat: list[float], bins: int = 32) -> float:
    arr = np.asarray(trail_flat, dtype=np.float64)
    if arr.size == 0:
        return 0.0
    hist, _ = np.histogram(arr, bins=bins, range=(0.0, max(1e-9, float(np.max(arr)))))
    return _safe_entropy(hist.astype(np.float64))


def shannon_entropy_positions(x: list[float], y: list[float], grid: int = 16) -> float:
    if not x:
        return 0.0
    xi = (np.clip(np.asarray(x, dtype=np.float64), 0.0, 1.0) * (grid - 1)).astype(int)
    yi = (np.clip(np.asarray(y, dtype=np.float64), 0.0, 1.0) * (grid - 1)).astype(int)
    idx = xi + yi * grid
    counts = np.bincount(idx, minlength=grid * grid)
    return _safe_entropy(counts.astype(np.float64))


def market_entropy(order_book: dict, bins: int = 24) -> float:
    b = np.asarray(order_book.get("bids", []), dtype=np.float64)
    a = np.asarray(order_book.get("asks", []), dtype=np.float64)
    if b.size == 0:
        return 0.0
    return (_safe_entropy(b) + _safe_entropy(a)) * 0.5


def emergence_index(
    ent_ant: float,
    ent_flock: float,
    ent_market: float,
    coupling_mag: float,
) -> float:
    """Heuristic: coupling + disagreement between subsystem entropies."""
    ent_mean = (ent_ant + ent_flock + ent_market) / 3.0
    spread = abs(ent_ant - ent_flock) + abs(ent_flock - ent_market) + abs(ent_ant - ent_market)
    return float(np.clip(0.22 * coupling_mag + 0.35 * spread + 0.18 * ent_mean, 0.0, 1.0))


def complexity_score(metrics: dict[str, float]) -> float:
    keys = ["entropy_ant", "entropy_flock", "entropy_market", "emergence", "coupling"]
    acc = sum(metrics.get(k, 0.0) for k in keys)
    return float(np.clip(acc / max(1, len(keys)), 0.0, 1.0))


def phase_transition_alert(entropy_series: list[float], window: int = 45) -> dict[str, Any]:
    if len(entropy_series) < window + 5:
        return {"active": False, "zscore": 0.0}
    arr = np.asarray(entropy_series[-window:], dtype=np.float64)
    mu = float(np.mean(arr))
    sd = float(np.std(arr)) + 1e-9
    last = float(entropy_series[-1])
    z = (last - mu) / sd
    active = abs(z) > 2.4
    return {"active": bool(active), "zscore": float(z), "direction": "up" if z > 0 else "down"}
