"""Flock experiment reproducibility and comparison."""

from __future__ import annotations

import numpy as np

from simulations.flock_experiment import run_flock_compare
from simulations.flocking import FlockingState


def test_reset_with_seed_matches_initial_positions() -> None:
    a = FlockingState()
    b = FlockingState()
    a.reset_with_seed(99)
    b.reset_with_seed(99)
    a.apply_params({"population": 200, "predator_speed": 0.02})
    b.apply_params({"population": 200, "predator_speed": 0.04})
    np.testing.assert_allclose(a.pos, b.pos)
    np.testing.assert_allclose(a.vel, b.vel)
    np.testing.assert_allclose(a.pred_pos, b.pred_pos)


def test_same_seed_reproduces_metrics_series() -> None:
    shared = {"population": 160}
    base = {"predator_speed": 0.02}
    one = run_flock_compare(base, {"predator_speed": 0.03}, shared=shared, seed=7, steps=80, sample_every=2)
    two = run_flock_compare(base, {"predator_speed": 0.03}, shared=shared, seed=7, steps=80, sample_every=2)
    m1 = one["baseline"]["metrics"]
    m2 = two["baseline"]["metrics"]
    assert len(m1) == len(m2) > 0
    for a, b in zip(m1, m2):
        assert a["cohesion"] == b["cohesion"]
        assert a["separation"] == b["separation"]


def test_predator_speed_changes_outcomes() -> None:
    res = run_flock_compare(
        {"predator_speed": 0.015},
        {"predator_speed": 0.04},
        seed=42,
        steps=120,
        sample_every=3,
    )
    b = res["baseline"]["summary"]["mean_cohesion"]
    v = res["variant"]["summary"]["mean_cohesion"]
    assert res["interpretation"]["disclaimer"]
    assert b != v or res["baseline"]["metrics"] != res["variant"]["metrics"]
