"""Ant colony foraging with pheromone trails and depleting food sources."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

import numpy as np


@dataclass
class FoodSource:
    x: float
    y: float
    qty: float


@dataclass
class AntColonyConfig:
    population: int = 220
    evaporation_rate: float = 0.02
    diffusion_rate: float = 0.15
    food_sources: int = 4
    grid_w: int = 96
    grid_h: int = 72
    nest_x: float = 0.5
    nest_y: float = 0.92
    nest_radius: float = 0.035
    smell_radius: float = 0.04
    ant_speed: float = 0.012
    wander: float = 0.35
    trail_deposit: float = 0.85
    food_coupling_boost: float = 1.0  # from market


@dataclass
class AntColonyState:
    cfg: AntColonyConfig = field(default_factory=AntColonyConfig)
    trail: np.ndarray = field(init=False)
    ants_x: np.ndarray = field(init=False)
    ants_y: np.ndarray = field(init=False)
    ants_a: np.ndarray = field(init=False)
    ants_carry: np.ndarray = field(init=False)
    food: list[FoodSource] = field(default_factory=list)
    total_foraged: float = 0.0
    tick_forage_rate: float = 0.0
    particles: list[dict] = field(default_factory=list)

    def __post_init__(self) -> None:
        gw, gh = self.cfg.grid_w, self.cfg.grid_h
        self.trail = np.zeros((gh, gw), dtype=np.float64)
        n = max(1, self.cfg.population)
        self.ants_x = np.random.rand(n).astype(np.float64)
        self.ants_y = np.random.rand(n).astype(np.float64)
        self.ants_a = (np.random.rand(n) * 2 * math.pi).astype(np.float64)
        self.ants_carry = np.zeros(n, dtype=np.int8)
        self._seed_food()

    def _seed_food(self) -> None:
        self.food = []
        for _ in range(max(1, self.cfg.food_sources)):
            self.food.append(
                FoodSource(
                    x=0.12 + random.random() * 0.76,
                    y=0.08 + random.random() * 0.55,
                    qty=80.0 + random.random() * 120.0,
                )
            )

    def reset(self) -> None:
        self.__dict__.pop("trail", None)
        self.__post_init__()

    def _world_to_grid(self, x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        gx = np.clip((x * (self.cfg.grid_w - 1)).astype(np.int32), 0, self.cfg.grid_w - 1)
        gy = np.clip((y * (self.cfg.grid_h - 1)).astype(np.int32), 0, self.cfg.grid_h - 1)
        return gx, gy

    def _sense_trail(self, x: float, y: float) -> tuple[float, float, float]:
        """Return trail strength and approximate gradient (dx, dy) in world units."""
        gw, gh = self.cfg.grid_w, self.cfg.grid_h
        fx = x * (gw - 1)
        fy = y * (gh - 1)
        ix, iy = int(fx), int(fy)
        ix = max(0, min(gw - 2, ix))
        iy = max(0, min(gh - 2, iy))
        t00 = self.trail[iy, ix]
        t10 = self.trail[iy, ix + 1]
        t01 = self.trail[iy + 1, ix]
        t11 = self.trail[iy + 1, ix + 1]
        gx_w = ((t10 + t11) - (t00 + t01)) * 0.5 * gw
        gy_w = ((t01 + t11) - (t00 + t10)) * 0.5 * gh
        center = (t00 + t10 + t01 + t11) * 0.25
        return center, gx_w, gy_w

    def step(self, dt: float = 1.0) -> None:
        cfg = self.cfg
        gw, gh = cfg.grid_w, cfg.grid_h
        boost = max(0.25, min(2.5, cfg.food_coupling_boost))
        speed = cfg.ant_speed * boost * (0.85 + 0.15 * dt)

        # Evaporation + diffusion
        ev = cfg.evaporation_rate * dt
        self.trail *= np.clip(1.0 - ev, 0.0, 1.0)
        if cfg.diffusion_rate > 0:
            d = cfg.diffusion_rate * dt
            lap = (
                np.roll(self.trail, 1, axis=0)
                + np.roll(self.trail, -1, axis=0)
                + np.roll(self.trail, 1, axis=1)
                + np.roll(self.trail, -1, axis=1)
            ) * 0.25
            self.trail = (1 - d) * self.trail + d * lap

        nx = self.ants_x.shape[0]
        nest_dx = cfg.nest_x - self.ants_x
        nest_dy = cfg.nest_y - self.ants_y
        nest_dist = np.sqrt(nest_dx * nest_dx + nest_dy * nest_dy) + 1e-6

        new_particles: list[dict] = []

        for i in range(nx):
            x, y = float(self.ants_x[i]), float(self.ants_y[i])
            ang = float(self.ants_a[i])
            carry = int(self.ants_carry[i])

            _, tx, ty = self._sense_trail(x, y)
            grad_mag = math.hypot(tx, ty) + 1e-6

            if carry:
                # Return to nest; lay pheromone along path
                desired = math.atan2(nest_dy[i], nest_dx[i])
                follow = math.atan2(ty, tx) if grad_mag > 1e-3 else desired
                ang = ang + 0.72 * _angle_diff(desired, ang) + 0.18 * _angle_diff(follow, ang)
                ang += (random.random() - 0.5) * cfg.wander * 0.35
                gx_i, gy_i = int(x * (gw - 1)), int(y * (gh - 1))
                gx_i = max(0, min(gw - 1, gx_i))
                gy_i = max(0, min(gh - 1, gy_i))
                self.trail[gy_i, gx_i] += cfg.trail_deposit * dt * 0.55

                if nest_dist[i] < cfg.nest_radius:
                    self.total_foraged += 1.0
                    self.ants_carry[i] = 0
                    ang += math.pi + (random.random() - 0.5) * 0.8
            else:
                # Seek food / follow trail
                desired = math.atan2(ty, tx) if grad_mag > 1e-3 else ang + (random.random() - 0.5) * 2.5
                ang = ang + 0.55 * _angle_diff(desired, ang)
                ang += (random.random() - 0.5) * cfg.wander

                # Food pickup
                for f in self.food:
                    if f.qty <= 0:
                        continue
                    dx, dy = f.x - x, f.y - y
                    if dx * dx + dy * dy < cfg.smell_radius * cfg.smell_radius:
                        take = min(5.0 * dt * boost, f.qty)
                        f.qty -= take
                        self.ants_carry[i] = 1
                        new_particles.append({"x": x, "y": y, "kind": "food"})
                        ang += math.pi + (random.random() - 0.5) * 0.4
                        break

            self.ants_a[i] = _wrap_angle(ang)
            self.ants_x[i] = x + math.cos(self.ants_a[i]) * speed
            self.ants_y[i] = y + math.sin(self.ants_a[i]) * speed

            # Boundaries
            if self.ants_x[i] < 0.02:
                self.ants_x[i] = 0.02
                self.ants_a[i] = math.pi - self.ants_a[i]
            elif self.ants_x[i] > 0.98:
                self.ants_x[i] = 0.98
                self.ants_a[i] = math.pi - self.ants_a[i]
            if self.ants_y[i] < 0.02:
                self.ants_y[i] = 0.02
                self.ants_a[i] = -self.ants_a[i]
            elif self.ants_y[i] > 0.98:
                self.ants_y[i] = 0.98
                self.ants_a[i] = -self.ants_a[i]

        self.tick_forage_rate = float(np.sum(self.ants_carry)) / max(1, nx)
        self.particles = (self.particles + new_particles)[-400:]

    def resize_population(self, n: int) -> None:
        n = max(20, min(600, int(n)))
        old_n = self.ants_x.shape[0]
        self.cfg.population = n
        if n == old_n:
            return
        self.ants_x = _resize_arr(self.ants_x, n)
        self.ants_y = _resize_arr(self.ants_y, n)
        self.ants_a = _resize_arr(self.ants_a, n)
        self.ants_carry = _resize_arr_i(self.ants_carry, n)

    def to_payload(self) -> dict:
        trail_list = [float(x) for x in np.clip(self.trail.flatten(), 0.0, None)]
        return {
            "nest": {"x": self.cfg.nest_x, "y": self.cfg.nest_y, "r": self.cfg.nest_radius},
            "grid": {"w": self.cfg.grid_w, "h": self.cfg.grid_h, "trail": trail_list},
            "ants": {
                "x": self.ants_x.tolist(),
                "y": self.ants_y.tolist(),
                "carry": self.ants_carry.astype(int).tolist(),
            },
            "food": [{"x": f.x, "y": f.y, "q": max(0.0, f.qty)} for f in self.food],
            "total_foraged": self.total_foraged,
            "forage_velocity": self.tick_forage_rate,
            "particles": list(self.particles[-80:]),
            "params": {
                "population": self.cfg.population,
                "evaporation_rate": self.cfg.evaporation_rate,
                "diffusion_rate": self.cfg.diffusion_rate,
                "food_sources": self.cfg.food_sources,
            },
        }


def _angle_diff(a: float, b: float) -> float:
    d = (a - b + math.pi) % (2 * math.pi) - math.pi
    return d


def _wrap_angle(a: float) -> float:
    return (a + math.pi) % (2 * math.pi) - math.pi


def _resize_arr(a: np.ndarray, n: int) -> np.ndarray:
    out = np.zeros(n, dtype=np.float64)
    m = min(len(a), n)
    out[:m] = a[:m]
    if n > m:
        out[m:] = np.random.rand(n - m)
    return out


def _resize_arr_i(a: np.ndarray, n: int) -> np.ndarray:
    out = np.zeros(n, dtype=np.int8)
    m = min(len(a), n)
    out[:m] = a[:m]
    return out
