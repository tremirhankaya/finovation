from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .constraints import ProspectusConstraints


@dataclass(frozen=True)
class DecodedAction:
    target_weights: np.ndarray
    status: str
    requested_heavy_count: int
    applied_heavy_count: int
    heavy_sum: float


def _bounded_sigmoid_allocation(
    scores: np.ndarray,
    total: float,
    lower: float,
    upper: float,
) -> np.ndarray:
    """Allocate an exact total inside identical bounds while preserving score order."""
    scores = np.asarray(scores, dtype=np.float64)
    count = len(scores)
    if count == 0:
        if abs(total) > 1e-12:
            raise ValueError("Nonzero total requested for an empty group")
        return scores.copy()
    if total < count * lower - 1e-12 or total > count * upper + 1e-12:
        raise ValueError("Requested group total is outside allocation bounds")
    if upper <= lower:
        return np.full(count, lower, dtype=np.float64)
    scaled = 5.0 * (scores - float(np.mean(scores)))
    left, right = -60.0, 60.0
    for _ in range(100):
        shift = 0.5 * (left + right)
        sigmoid = 1.0 / (1.0 + np.exp(-(scaled + shift)))
        current = float((lower + (upper - lower) * sigmoid).sum())
        if current < total:
            left = shift
        else:
            right = shift
    shift = 0.5 * (left + right)
    result = lower + (upper - lower) / (1.0 + np.exp(-(scaled + shift)))
    result += (total - float(result.sum())) / count
    return result


class FeasibleActionDecoder:
    """Deterministic feasible transform; this is the policy's action layer, not a repair projection."""

    def __init__(self, config: dict, equity_count: int):
        self.config = config
        self.equity_count = int(equity_count)
        self.constraints = ProspectusConstraints(config["constraints"], equity_count)
        c = config["constraints"]
        op = c["operational"]
        self.tpp_min = float(c["tpp_min"])
        self.tpp_max = float(c["tpp_max"])
        self.stock_min = float(c["stock_weight_min"])
        self.stock_max = float(c["stock_weight_max"])
        self.light_max = float(op["light_weight_max"])
        self.heavy_min = float(op["heavy_weight_min"])
        self.heavy_sum_max = float(op["heavy_sum_max"])
        self.k_min = int(op["heavy_count_min"])
        self.k_max = int(op["heavy_count_max"])

    @staticmethod
    def _unit(value: float) -> float:
        return float(np.clip((value + 1.0) * 0.5, 0.0, 1.0))

    def _heavy_bounds(self, equity_sum: float, count: int) -> tuple[float, float]:
        light_count = self.equity_count - count
        lower = max(count * self.heavy_min, equity_sum - light_count * self.light_max)
        upper = min(
            count * self.stock_max,
            self.heavy_sum_max,
            equity_sum - light_count * self.stock_min,
        )
        return float(lower), float(upper)

    def decode(self, action: np.ndarray, current_weights: np.ndarray) -> DecodedAction:
        raw = np.asarray(action, dtype=np.float64).reshape(-1)
        if raw.shape != (self.equity_count + 4,) or not np.isfinite(raw).all():
            raise ValueError("Invalid continuous action")
        raw = np.clip(raw, -1.0, 1.0)
        current = np.asarray(current_weights, dtype=np.float64)
        current_legal = self.constraints.validate(current).ok
        if raw[0] <= 0.0 and current_legal:
            equities = current[:-1]
            heavy = equities > self.constraints.heavy_threshold
            return DecodedAction(
                current.copy(), "HOLD", int(heavy.sum()), int(heavy.sum()), float(equities[heavy].sum())
            )

        tpp = self.tpp_min + self._unit(raw[1]) * (self.tpp_max - self.tpp_min)
        equity_sum = 1.0 - tpp
        requested = self.k_min + int(
            np.floor(self._unit(raw[3]) * (self.k_max - self.k_min + 1))
        )
        requested = min(requested, self.k_max)
        feasible: list[tuple[int, float, float]] = []
        for count in range(self.k_min, self.k_max + 1):
            lower, upper = self._heavy_bounds(equity_sum, count)
            if lower <= upper + 1e-12:
                feasible.append((count, lower, upper))
        if not feasible:
            raise RuntimeError("No prospectus-feasible heavy count for decoded TPP")
        count, heavy_low, heavy_high = min(feasible, key=lambda item: (abs(item[0] - requested), item[0]))
        heavy_sum = heavy_low + self._unit(raw[2]) * max(0.0, heavy_high - heavy_low)
        scores = raw[4:]
        order = np.argsort(-scores, kind="stable")
        heavy_index = order[:count]
        light_index = order[count:]
        equities = np.empty(self.equity_count, dtype=np.float64)
        equities[heavy_index] = _bounded_sigmoid_allocation(
            scores[heavy_index], heavy_sum, self.heavy_min, self.stock_max
        )
        equities[light_index] = _bounded_sigmoid_allocation(
            scores[light_index], equity_sum - heavy_sum, self.stock_min, self.light_max
        )
        target = np.append(equities, 1.0 - float(equities.sum()))
        self.constraints.require(target)
        return DecodedAction(
            target,
            "FORCED_REBALANCE" if raw[0] <= 0.0 and not current_legal else "REBALANCE",
            requested,
            count,
            float(equities[equities > self.constraints.heavy_threshold].sum()),
        )
