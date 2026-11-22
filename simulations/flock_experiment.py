"""Headless flock A/B experiments with matched seeds and shared conditions."""

from __future__ import annotations

from statistics import mean
from typing import Any

from simulations.flocking import FlockingState

MAX_STEPS = 600
MIN_STEPS = 50
DEFAULT_STEPS = 240
MAX_SNAPSHOTS = 56
DEFAULT_SAMPLE_EVERY = 4


def _clip_shared_params(raw: dict[str, Any] | None) -> dict[str, float]:
    raw = raw or {}
    pop = int(raw.get("population", 320))
    pop = max(80, min(520, pop))
    return {
        "population": float(pop),
        "vision_radius": float(raw.get("vision_radius", 0.09)),
        "separation_weight": float(raw.get("separation_weight", 1.35)),
        "cohesion_weight": float(raw.get("cohesion_weight", 1.05)),
    }


def _clip_arm_overrides(raw: dict[str, Any] | None) -> dict[str, float]:
    raw = raw or {}
    out: dict[str, float] = {}
    if "predator_speed" in raw:
        out["predator_speed"] = float(raw["predator_speed"])
    if "predator_radius" in raw:
        out["predator_radius"] = float(raw["predator_radius"])
    return out


def _series_mean(series: list[dict[str, float]], key: str) -> float:
    if not series:
        return 0.0
    return float(mean(row[key] for row in series))


def _run_arm(
    shared: dict[str, float],
    arm_overrides: dict[str, float],
    seed: int,
    steps: int,
    sample_every: int,
) -> dict[str, Any]:
    flock = FlockingState()
    flock.reset_with_seed(seed)
    flock.apply_params({**shared, **arm_overrides})

    metrics_series: list[dict[str, float]] = []
    snapshots: list[dict] = []

    for tick in range(1, steps + 1):
        flock.step(1.0)
        if tick % sample_every != 0:
            continue
        row = {"tick": float(tick), **flock.measure_metrics()}
        metrics_series.append(row)
        if len(snapshots) < MAX_SNAPSHOTS:
            snapshots.append(flock.to_payload())

    return {
        "params": {**shared, **arm_overrides},
        "metrics": metrics_series,
        "snapshots": snapshots,
        "summary": {
            "mean_cohesion": _series_mean(metrics_series, "cohesion"),
            "mean_separation": _series_mean(metrics_series, "separation"),
            "mean_alignment": _series_mean(metrics_series, "alignment"),
            "mean_spatial_entropy": _series_mean(metrics_series, "spatial_entropy"),
            "mean_speed": _series_mean(metrics_series, "mean_speed"),
        },
    }


def interpret_comparison(
    baseline: dict[str, Any],
    variant: dict[str, Any],
    baseline_label: str,
    variant_label: str,
) -> dict[str, Any]:
    """Plain-language readout — descriptive, not causal claims."""
    b = baseline["summary"]
    v = variant["summary"]
    deltas = {
        "cohesion": v["mean_cohesion"] - b["mean_cohesion"],
        "separation": v["mean_separation"] - b["mean_separation"],
        "alignment": v["mean_alignment"] - b["mean_alignment"],
        "spatial_entropy": v["mean_spatial_entropy"] - b["mean_spatial_entropy"],
        "mean_speed": v["mean_speed"] - b["mean_speed"],
    }

    bullets: list[str] = []
    coh_eps = 0.04
    sep_eps = 0.002
    ent_eps = 0.08

    if deltas["cohesion"] > coh_eps:
        bullets.append(
            f"Compared with {baseline_label}, {variant_label} spent more ticks with higher neighbor density (cohesion proxy up {deltas['cohesion']:.3f} on average)."
        )
    elif deltas["cohesion"] < -coh_eps:
        bullets.append(
            f"Compared with {baseline_label}, {variant_label} showed looser grouping (cohesion proxy down {abs(deltas['cohesion']):.3f})."
        )
    else:
        bullets.append("Average cohesion stayed similar between arms in this run.")

    if deltas["separation"] > sep_eps:
        bullets.append(
            f"Mean nearest-neighbor distance increased ({deltas['separation']:.4f}), consistent with boids spreading out more."
        )
    elif deltas["separation"] < -sep_eps:
        bullets.append(
            f"Mean nearest-neighbor distance decreased ({abs(deltas['separation']):.4f}), consistent with tighter spacing."
        )

    if deltas["spatial_entropy"] > ent_eps:
        bullets.append("Spatial entropy was higher in the variant — positions occupied more of the arena grid.")
    elif deltas["spatial_entropy"] < -ent_eps:
        bullets.append("Spatial entropy was lower in the variant — the flock used a smaller portion of the arena.")

    if abs(deltas["mean_speed"]) > 0.002:
        direction = "faster" if deltas["mean_speed"] > 0 else "slower"
        bullets.append(f"Boids moved {direction} on average in the variant (Δ speed {deltas['mean_speed']:.4f}).")

    disclaimer = (
        "This is a stylized boid model with one predator, not biological field data. "
        "Differences here support exploration of the rule set, not general claims about real murmurations."
    )

    return {"deltas": deltas, "bullets": bullets, "disclaimer": disclaimer}


def run_flock_compare(
    baseline: dict[str, Any] | None,
    variant: dict[str, Any] | None,
    *,
    shared: dict[str, Any] | None = None,
    seed: int = 42,
    steps: int = DEFAULT_STEPS,
    sample_every: int = DEFAULT_SAMPLE_EVERY,
) -> dict[str, Any]:
    steps = int(max(MIN_STEPS, min(MAX_STEPS, steps)))
    sample_every = int(max(1, min(20, sample_every)))
    seed = int(seed) & 0x7FFFFFFF

    shared_params = _clip_shared_params(shared)
    base_overrides = _clip_arm_overrides(baseline)
    var_overrides = _clip_arm_overrides(variant)

    if "predator_speed" not in base_overrides:
        base_overrides["predator_speed"] = 0.018
    if "predator_speed" not in var_overrides:
        var_overrides["predator_speed"] = 0.034

    baseline_arm = _run_arm(shared_params, base_overrides, seed, steps, sample_every)
    variant_arm = _run_arm(shared_params, var_overrides, seed, steps, sample_every)

    b_speed = float(base_overrides.get("predator_speed", 0.018))
    v_speed = float(var_overrides.get("predator_speed", 0.034))
    baseline_label = f"baseline (predator speed {b_speed:.3f})"
    variant_label = f"variant (predator speed {v_speed:.3f})"

    interpretation = interpret_comparison(
        baseline_arm, variant_arm, baseline_label, variant_label
    )

    return {
        "seed": seed,
        "steps": steps,
        "sample_every": sample_every,
        "shared": shared_params,
        "baseline": baseline_arm,
        "variant": variant_arm,
        "interpretation": interpretation,
    }
