"""Flocking boids with predator — 2D dynamics with optional 3D projection client-side."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

import numpy as np


@dataclass
class FlockingConfig:
    population: int = 320
    vision_radius: float = 0.09
    separation_weight: float = 1.35
    alignment_weight: float = 1.0
    cohesion_weight: float = 1.05
    predator_speed: float = 0.022
    max_speed: float = 0.035
    max_force: float = 0.95
    predator_radius: float = 0.045
    sentiment_coupling: float = 0.0  # filled by engine


@dataclass
class FlockingState:
    cfg: FlockingConfig = field(default_factory=FlockingConfig)
    pos: np.ndarray = field(init=False)
    vel: np.ndarray = field(init=False)
    pred_pos: np.ndarray = field(init=False)
    pred_vel: np.ndarray = field(init=False)
    cohesion_metric: float = 0.0

    def __post_init__(self) -> None:
        n = max(30, self.cfg.population)
        self.cfg.population = n
        self.pos = np.random.rand(n, 2).astype(np.float64)
        self.pos[:, 0] *= 0.85
        self.pos[:, 0] += 0.075
        self.pos[:, 1] *= 0.85
        self.pos[:, 1] += 0.075
        ang = (np.random.rand(n) * 2 * math.pi).astype(np.float64)
        sp = self.cfg.max_speed * (0.45 + 0.55 * np.random.rand(n))
        self.vel = np.stack([np.cos(ang) * sp, np.sin(ang) * sp], axis=1)
        self.pred_pos = np.array([0.15 + random.random() * 0.7, 0.15 + random.random() * 0.7], dtype=np.float64)
        pv = np.random.randn(2).astype(np.float64)
        pv /= np.linalg.norm(pv) + 1e-9
        self.pred_vel = pv * self.cfg.predator_speed

    def reset(self) -> None:
        self.__post_init__()

    def resize(self, n: int) -> None:
        n = max(50, min(650, int(n)))
        old = self.pos.shape[0]
        self.cfg.population = n
        if n == old:
            return
        new_pos = np.random.rand(n, 2).astype(np.float64)
        new_vel = np.zeros_like(new_pos)
        m = min(old, n)
        if m > 0:
            new_pos[:m] = self.pos[:m]
            new_vel[:m] = self.vel[:m]
        if n > old:
            extra = n - old
            new_pos[old:] = np.random.rand(extra, 2)
            ang = np.random.rand(extra) * 2 * math.pi
            sp = self.cfg.max_speed * 0.55
            new_vel[old:, 0] = np.cos(ang) * sp
            new_vel[old:, 1] = np.sin(ang) * sp
        self.pos, self.vel = new_pos, new_vel

    def step(self, dt: float = 1.0) -> None:
        cfg = self.cfg
        n = self.pos.shape[0]
        if n < 2:
            return

        # Pairwise vectors pos[j]-pos[i] stored as diff[j,i] = pos[j]-pos[i] ... use broadcasting
        p = self.pos
        diff = p[np.newaxis, :, :] - p[:, np.newaxis, :]
        dist = np.linalg.norm(diff, axis=2) + 1e-9
        eye = np.eye(n, dtype=bool)
        dist_sq = dist * dist

        vision = cfg.vision_radius
        mask = (dist < vision) & (~eye)

        # neighbors count for cohesion metric
        neigh = np.sum(mask, axis=1).astype(np.float64)
        self.cohesion_metric = float(np.mean(neigh / max(1.0, n * 0.05)))

        sep = np.zeros((n, 2), dtype=np.float64)
        ali = np.zeros((n, 2), dtype=np.float64)
        coh = np.zeros((n, 2), dtype=np.float64)

        for i in range(n):
            idx = np.where(mask[i])[0]
            if idx.size == 0:
                continue
            away = -diff[i, idx] / (dist_sq[i, idx, np.newaxis] + 1e-7)
            sep[i] = np.sum(away, axis=0)
            ali[i] = np.mean(self.vel[idx], axis=0)
            coh[i] = np.mean(p[idx], axis=0) - p[i]

        sep = _limit_magnitude(sep, cfg.max_force)
        ali = _limit_magnitude(ali, cfg.max_force)
        coh = _limit_magnitude(coh, cfg.max_force)

        acc = (
            cfg.separation_weight * sep
            + cfg.alignment_weight * ali
            + cfg.cohesion_weight * coh
        )

        # Predator repulsion
        to_pred = self.pred_pos[np.newaxis, :] - p
        pd = np.linalg.norm(to_pred, axis=1) + 1e-9
        flee = np.zeros((n, 2), dtype=np.float64)
        close = pd < cfg.predator_radius * 4.5
        if np.any(close):
            dir_away = -to_pred / pd[:, np.newaxis]
            strength = (cfg.predator_radius * 4.5 - pd)[:, np.newaxis] / (cfg.predator_radius * 4.5)
            flee = np.where(close[:, np.newaxis], dir_away * strength * 2.8, flee)

        acc = acc + flee

        # Sentiment bias from market (coherent flock = bullish): slight upward drift
        sc = cfg.sentiment_coupling
        if abs(sc) > 1e-6:
            acc[:, 1] += sc * 0.06 * dt

        self.vel += acc * 0.045 * dt
        sp = np.linalg.norm(self.vel, axis=1, keepdims=True) + 1e-9
        self.vel = np.where(sp > cfg.max_speed, self.vel / sp * cfg.max_speed, self.vel)

        self.pos += self.vel * dt

        # Soft bounce walls
        margin = 0.02
        for dim in (0, 1):
            low = self.pos[:, dim] < margin
            high = self.pos[:, dim] > 1.0 - margin
            self.pos[low, dim] = margin
            self.pos[high, dim] = 1.0 - margin
            self.vel[low, dim] *= -1
            self.vel[high, dim] *= -1

        # Predator motion toward flock + jitter
        com = np.mean(p, axis=0)
        target = com * 0.62 + p[np.random.randint(0, n)] * 0.38
        toward = target - self.pred_pos
        tn = np.linalg.norm(toward) + 1e-9
        desired = toward / tn * cfg.predator_speed * (1.05 + 0.25 * math.sin(self.pred_pos[0] * 14.2))
        self.pred_vel = self.pred_vel * 0.88 + desired * 0.12
        pv = np.linalg.norm(self.pred_vel) + 1e-9
        if pv > cfg.predator_speed * 1.6:
            self.pred_vel = self.pred_vel / pv * cfg.predator_speed * 1.6
        self.pred_pos += self.pred_vel * dt * 1.05
        self.pred_pos = np.clip(self.pred_pos, margin, 1.0 - margin)

    def to_payload(self) -> dict:
        return {
            "boids": {"x": self.pos[:, 0].tolist(), "y": self.pos[:, 1].tolist()},
            "predator": {"x": float(self.pred_pos[0]), "y": float(self.pred_pos[1])},
            "cohesion": self.cohesion_metric,
            "params": {
                "population": int(self.pos.shape[0]),
                "vision_radius": self.cfg.vision_radius,
                "separation_weight": self.cfg.separation_weight,
                "cohesion_weight": self.cfg.cohesion_weight,
                "predator_speed": self.cfg.predator_speed,
            },
        }


def _limit_magnitude(v: np.ndarray, max_mag: float) -> np.ndarray:
    m = np.linalg.norm(v, axis=1, keepdims=True) + 1e-9
    scale = np.minimum(1.0, max_mag / m)
    return v * scale
