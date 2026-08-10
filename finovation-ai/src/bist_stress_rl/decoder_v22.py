from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .constraints import ProspectusConstraints


def _bounded_multiplicative_allocation(
    base: np.ndarray,
    scores: np.ndarray,
    total: float,
    lower: float,
    upper: float,
    scale: float,
) -> np.ndarray:
    base = np.asarray(base, dtype=np.float64)
    scores = np.asarray(scores, dtype=np.float64)
    count = len(base)
    if not count:
        return np.empty(0, dtype=np.float64)
    if total < count * lower - 1e-12 or total > count * upper + 1e-12:
        raise ValueError("Bounded allocation total is infeasible")
    raw = np.clip(base, lower, upper) * np.exp(np.clip(scale * scores, -3.0, 3.0))
    lo, hi = 0.0, max(1.0, total / max(float(raw.min()), 1e-12) * 4.0)
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        value = float(np.clip(mid * raw, lower, upper).sum())
        if value < total:
            lo = mid
        else:
            hi = mid
    result = np.clip(0.5 * (lo + hi) * raw, lower, upper)
    residual = total - float(result.sum())
    if abs(residual) > 1e-12:
        if residual > 0:
            room = upper - result
        else:
            room = result - lower
        active = room > 1e-14
        if not active.any():
            raise RuntimeError("Allocation residual has no feasible receiver")
        result[active] += residual * room[active] / float(room[active].sum())
    return result


@dataclass(frozen=True)
class DecodedActionV22:
    target_weights: np.ndarray
    raw_candidate: np.ndarray
    status: str
    requested_heavy_count: int
    applied_heavy_count: int
    heavy_sum: float
    target_change_turnover: float
    budget: float
    budget_saturated: bool
    heavy_switches: int
    dynamic_tpp_min: float
    requested_tpp: float = float("nan")
    applied_tpp: float = float("nan")
    reason_primary: str = ""
    no_change_applied: bool = False
    geometry_clip: bool = False
    execution_tier: str = ""
    membership_flips: int = 0


class DeltaFeasibleDecoderV22:
    """Previous-target-relative direct feasible transform for 16 equities plus TPP."""

    def __init__(self, config: dict):
        self.config = config
        self.n = len(config["universe"]["tickers"])
        self.constraints = ProspectusConstraints(config["constraints"], self.n)
        operational = config["constraints"]["operational"]
        self.tpp_min = float(operational["tpp_min"])
        self.tpp_max = float(operational["tpp_max"])
        self.light_max = float(operational["light_weight_max"])
        self.heavy_min = float(operational["heavy_weight_min"])
        self.stock_min = float(operational["stock_weight_min"])
        self.stock_max = float(operational["stock_weight_max"])
        self.heavy_sum_max = float(operational["heavy_sum_max"])
        self.k_min = int(operational["heavy_count_min"])
        self.k_max = int(operational["heavy_count_max"])
        self.action_cfg = config["action"]

    def _tpp_bounds(self, heavy_count: int) -> tuple[float, float]:
        light_count = self.n - heavy_count
        min_equity = heavy_count * self.heavy_min + light_count * self.stock_min
        max_equity = min(heavy_count * self.stock_max, self.heavy_sum_max) + light_count * self.light_max
        lower = max(self.tpp_min, 1.0 - max_equity)
        upper = min(self.tpp_max, 1.0 - min_equity)
        if lower > upper + 1e-12:
            raise ValueError(f"Infeasible heavy count: {heavy_count}")
        return float(lower), float(upper)

    def _heavy_bounds(self, equity_sum: float, heavy_count: int) -> tuple[float, float]:
        light_count = self.n - heavy_count
        lower = max(heavy_count * self.heavy_min, equity_sum - light_count * self.light_max)
        upper = min(
            heavy_count * self.stock_max,
            self.heavy_sum_max,
            equity_sum - light_count * self.stock_min,
        )
        if lower > upper + 1e-12:
            raise ValueError("Infeasible heavy-group total")
        return float(lower), float(upper)

    @staticmethod
    def _requested_delta(value: float) -> int:
        if value < -0.60:
            return -2
        if value < -0.20:
            return -1
        if value <= 0.20:
            return 0
        if value <= 0.60:
            return 1
        return 2

    def _select_heavy(
        self,
        scores: np.ndarray,
        current_heavy: np.ndarray,
        requested_count: int,
        switch_ages: np.ndarray,
    ) -> np.ndarray:
        adjusted = scores.copy()
        adjusted[current_heavy] += float(self.action_cfg["heavy_incumbency_bonus"])
        order = np.argsort(-adjusted, kind="stable")
        selected = np.zeros(self.n, dtype=bool)
        selected[order[:requested_count]] = True
        if requested_count != int(current_heavy.sum()):
            return selected
        outgoing = np.flatnonzero(current_heavy & ~selected)
        incoming = np.flatnonzero(~current_heavy & selected)
        if not len(outgoing):
            return current_heavy.copy()
        cooldown = int(self.action_cfg["heavy_switch_cooldown_sessions"])
        margin = float(self.action_cfg["heavy_membership_score_margin"])
        result = current_heavy.copy()
        for old, new in zip(
            outgoing[np.argsort(adjusted[outgoing])], incoming[np.argsort(-adjusted[incoming])]
        ):
            if switch_ages[old] < cooldown or switch_ages[new] < cooldown:
                continue
            if adjusted[new] - adjusted[old] < margin:
                continue
            result[old] = False
            result[new] = True
        return result

    def decode(
        self,
        action: np.ndarray,
        previous_target: np.ndarray,
        *,
        stress_active: bool,
        elapsed_sessions: int,
        switch_ages: np.ndarray | None = None,
    ) -> DecodedActionV22:
        raw = np.asarray(action, dtype=np.float64).reshape(-1)
        previous = np.asarray(previous_target, dtype=np.float64).reshape(-1)
        if raw.shape != (self.n + 2,) or not np.isfinite(raw).all():
            raise ValueError("Invalid V2.2 continuous action")
        if previous.shape != (self.n + 1,):
            raise ValueError("Invalid previous committed target")
        self.constraints.require(previous)
        raw = np.clip(raw, -1.0, 1.0)
        if switch_ages is None:
            switch_ages = np.full(self.n, 10_000, dtype=np.int32)
        else:
            switch_ages = np.asarray(switch_ages, dtype=np.int32)

        alert = bool(stress_active and elapsed_sessions == 0)
        cap = float(
            self.action_cfg["tpp_delta_cap_alert"] if alert else self.action_cfg["tpp_delta_cap_normal"]
        )
        response = float(
            self.action_cfg["response_rate_alert"] if alert else self.action_cfg["response_rate_normal"]
        )
        budget = float(
            self.action_cfg["target_one_way_budget_alert"]
            if alert
            else self.action_cfg["target_one_way_budget_normal"]
        )
        current_heavy = previous[:-1] > self.constraints.heavy_threshold
        current_count = int(current_heavy.sum())
        requested_count = int(
            np.clip(current_count + self._requested_delta(float(raw[1])), self.k_min, self.k_max)
        )
        scores = raw[2:]
        heavy = self._select_heavy(scores, current_heavy, requested_count, switch_ages)
        requested_count = int(heavy.sum())
        tpp_low, tpp_high = self._tpp_bounds(requested_count)
        desired_tpp = float(np.clip(previous[-1] + cap * raw[0], tpp_low, tpp_high))
        equity_sum = 1.0 - desired_tpp
        heavy_low, heavy_high = self._heavy_bounds(equity_sum, requested_count)
        previous_heavy_total = float(previous[:-1][heavy].sum())
        score_gap = float(np.mean(scores[heavy]) - np.mean(scores[~heavy]))
        heavy_total = float(
            np.clip(previous_heavy_total + 0.04 * np.tanh(score_gap), heavy_low, heavy_high)
        )
        candidate_equities = np.empty(self.n, dtype=np.float64)
        candidate_equities[heavy] = _bounded_multiplicative_allocation(
            previous[:-1][heavy],
            scores[heavy],
            heavy_total,
            self.heavy_min,
            self.stock_max,
            float(self.action_cfg["tilt_scale"]),
        )
        candidate_equities[~heavy] = _bounded_multiplicative_allocation(
            previous[:-1][~heavy],
            scores[~heavy],
            equity_sum - heavy_total,
            self.stock_min,
            self.light_max,
            float(self.action_cfg["tilt_scale"]),
        )
        raw_candidate = np.r_[candidate_equities, desired_tpp]
        self.constraints.require(raw_candidate)

        if np.max(np.abs(raw)) <= 1e-12:
            target = previous.copy()
            status = "TARGET_UNCHANGED_ZERO_ACTION"
        else:
            blended = (1.0 - response) * previous + response * raw_candidate
            target = blended if self.constraints.validate(blended).ok else raw_candidate.copy()
            status = "TARGET_UPDATED"
        turnover = 0.5 * float(np.abs(target - previous).sum())
        saturated = False
        if turnover > budget + 1e-12:
            same_membership = np.array_equal(
                target[:-1] > self.constraints.heavy_threshold, current_heavy
            )
            if same_membership:
                alpha = budget / turnover
                limited = previous + alpha * (target - previous)
                if self.constraints.validate(limited).ok:
                    target = limited
                    turnover = budget
                    saturated = True
                    status = "TARGET_BUDGET_LIMITED"
                else:
                    target = previous.copy()
                    turnover = 0.0
                    saturated = True
                    status = "TARGET_BUDGET_BLOCKED"
            elif turnover > budget:
                target = previous.copy()
                turnover = 0.0
                saturated = True
                status = "HEAVY_SWITCH_BUDGET_BLOCKED"
        if turnover < float(self.action_cfg["target_no_change_band"]):
            target = previous.copy()
            turnover = 0.0
            status = "TARGET_NO_CHANGE_BAND"
        self.constraints.require(target)
        final_heavy = target[:-1] > self.constraints.heavy_threshold
        switches = int(np.count_nonzero(final_heavy != current_heavy))
        return DecodedActionV22(
            target_weights=target,
            raw_candidate=raw_candidate,
            status=status,
            requested_heavy_count=requested_count,
            applied_heavy_count=int(final_heavy.sum()),
            heavy_sum=float(target[:-1][final_heavy].sum()),
            target_change_turnover=float(turnover),
            budget=budget,
            budget_saturated=bool(saturated),
            heavy_switches=switches,
            dynamic_tpp_min=tpp_low,
        )
