from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .constraints import ProspectusConstraints
from .decoder_v22 import DecodedActionV22, _bounded_multiplicative_allocation


@dataclass(frozen=True)
class _ExecutionTierV22d:
    name: str
    response: float
    tpp_max_step: float
    target_budget: float
    max_heavy_count_delta: int
    max_membership_swaps: int


class AbsoluteFeasibleDecoderV22d:
    """Direct-feasible V2.2d decoder with TPP outside the heavy-stock rule.

    TPP is never counted as a heavy asset and never participates in the
    strict-above-5% equity sum.  TPP and the heavy count are nevertheless
    jointly feasible because all 17 portfolio weights must sum to one.
    """

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
        light_count = self.n - int(heavy_count)
        minimum_equity = (
            heavy_count * self.heavy_min + light_count * self.stock_min
        )
        maximum_equity = (
            min(heavy_count * self.stock_max, self.heavy_sum_max)
            + light_count * self.light_max
        )
        lower = max(self.tpp_min, 1.0 - maximum_equity)
        upper = min(self.tpp_max, 1.0 - minimum_equity)
        if lower > upper + 1e-12:
            raise ValueError(f"Infeasible V2.2d heavy count: {heavy_count}")
        return float(lower), float(upper)

    def _heavy_bounds(self, equity_sum: float, heavy_count: int) -> tuple[float, float]:
        light_count = self.n - int(heavy_count)
        lower = max(
            heavy_count * self.heavy_min,
            equity_sum - light_count * self.light_max,
        )
        upper = min(
            heavy_count * self.stock_max,
            self.heavy_sum_max,
            equity_sum - light_count * self.stock_min,
        )
        if lower > upper + 1e-12:
            raise ValueError("Infeasible V2.2d heavy-group total")
        return float(lower), float(upper)

    def _tier(self, stress_active: bool, elapsed_sessions: int) -> _ExecutionTierV22d:
        if stress_active and elapsed_sessions == 0:
            name = "ALERT"
        elif stress_active:
            name = "ACTIVE_STRESS"
        else:
            name = "NORMAL"
        cfg = self.action_cfg["execution_tiers"][name]
        return _ExecutionTierV22d(
            name=name,
            response=float(cfg["response"]),
            tpp_max_step=float(cfg["tpp_max_step"]),
            target_budget=float(cfg["target_one_way_budget"]),
            max_heavy_count_delta=int(cfg["max_heavy_count_delta"]),
            max_membership_swaps=int(cfg["max_membership_swaps"]),
        )

    def _requested_tpp(self, value: float) -> float:
        mapping = self.action_cfg["tpp_absolute_mapping"]
        requested = float(mapping["midpoint"]) + float(mapping["half_range"]) * value
        return float(np.clip(requested, self.tpp_min, self.tpp_max))

    def _requested_heavy_count(self, value: float) -> int:
        requested = int(np.floor(4.0 + 2.0 * value + 0.5))
        return int(np.clip(requested, self.k_min, self.k_max))

    def _select_feasible_count(
        self,
        tpp_candidate: float,
        requested_count: int,
        current_count: int,
        max_delta: int,
    ) -> tuple[int, float, bool]:
        reachable = [
            count
            for count in range(self.k_min, self.k_max + 1)
            if abs(count - current_count) <= max_delta
        ]
        feasible = []
        for count in reachable:
            low, high = self._tpp_bounds(count)
            if low - 1e-12 <= tpp_candidate <= high + 1e-12:
                feasible.append(count)
        if feasible:
            selected = min(
                feasible,
                key=lambda count: (
                    abs(count - requested_count),
                    abs(count - current_count),
                    count,
                ),
            )
            return int(selected), float(tpp_candidate), False

        def distance(count: int) -> float:
            low, high = self._tpp_bounds(count)
            return max(low - tpp_candidate, tpp_candidate - high, 0.0)

        selected = min(
            reachable,
            key=lambda count: (
                distance(count),
                abs(count - requested_count),
                abs(count - current_count),
                count,
            ),
        )
        low, high = self._tpp_bounds(selected)
        return int(selected), float(np.clip(tpp_candidate, low, high)), True

    def _select_heavy(
        self,
        scores: np.ndarray,
        current_heavy: np.ndarray,
        requested_count: int,
        switch_ages: np.ndarray,
        max_swaps: int,
    ) -> np.ndarray:
        result = current_heavy.copy()
        adjusted = np.asarray(scores, dtype=np.float64).copy()
        adjusted[current_heavy] += float(self.action_cfg["heavy_incumbency_bonus"])
        cooldown = int(self.action_cfg["heavy_switch_cooldown_sessions"])
        margin = float(self.action_cfg["heavy_membership_score_margin"])
        current_count = int(result.sum())

        if requested_count > current_count:
            candidates = np.flatnonzero(~result)
            candidates = candidates[np.argsort(-adjusted[candidates], kind="stable")]
            for incoming in candidates:
                if int(result.sum()) >= requested_count:
                    break
                if switch_ages[incoming] < cooldown:
                    continue
                result[incoming] = True
            return result

        if requested_count < current_count:
            candidates = np.flatnonzero(result)
            candidates = candidates[np.argsort(adjusted[candidates], kind="stable")]
            for outgoing in candidates:
                if int(result.sum()) <= requested_count:
                    break
                if switch_ages[outgoing] < cooldown:
                    continue
                result[outgoing] = False
            return result

        outgoing = np.flatnonzero(result)
        incoming = np.flatnonzero(~result)
        outgoing = outgoing[np.argsort(adjusted[outgoing], kind="stable")]
        incoming = incoming[np.argsort(-adjusted[incoming], kind="stable")]
        swap_count = 0
        for old, new in zip(outgoing, incoming):
            if swap_count >= max_swaps:
                break
            if switch_ages[old] < cooldown or switch_ages[new] < cooldown:
                continue
            if adjusted[new] - adjusted[old] < margin:
                continue
            result[old] = False
            result[new] = True
            swap_count += 1
        return result

    def _build_candidate(
        self,
        previous: np.ndarray,
        scores: np.ndarray,
        heavy: np.ndarray,
        tpp_weight: float,
        response: float,
    ) -> np.ndarray:
        heavy_count = int(heavy.sum())
        low, high = self._tpp_bounds(heavy_count)
        tpp_weight = float(np.clip(tpp_weight, low, high))
        equity_sum = 1.0 - tpp_weight
        heavy_low, heavy_high = self._heavy_bounds(equity_sum, heavy_count)
        previous_heavy_total = float(previous[:-1][heavy].sum())
        score_gap = float(np.mean(scores[heavy]) - np.mean(scores[~heavy]))
        heavy_total = float(
            np.clip(
                previous_heavy_total + response * 0.04 * np.tanh(score_gap),
                heavy_low,
                heavy_high,
            )
        )
        scale = float(self.action_cfg["equity_tilt_scale"]) * response
        equities = np.empty(self.n, dtype=np.float64)
        equities[heavy] = _bounded_multiplicative_allocation(
            previous[:-1][heavy],
            scores[heavy],
            heavy_total,
            self.heavy_min,
            self.stock_max,
            scale,
        )
        equities[~heavy] = _bounded_multiplicative_allocation(
            previous[:-1][~heavy],
            scores[~heavy],
            equity_sum - heavy_total,
            self.stock_min,
            self.light_max,
            scale,
        )
        candidate = np.r_[equities, tpp_weight]
        self.constraints.require(candidate)
        return candidate

    @staticmethod
    def _turnover(left: np.ndarray, right: np.ndarray) -> float:
        return 0.5 * float(np.abs(np.asarray(left) - np.asarray(right)).sum())

    def _line_limit_same_membership(
        self,
        previous: np.ndarray,
        candidate: np.ndarray,
        budget: float,
    ) -> tuple[np.ndarray, bool]:
        turnover = self._turnover(previous, candidate)
        if turnover <= budget + 1e-12:
            return candidate.copy(), False
        alpha = budget / max(turnover, 1e-12)
        limited = previous + alpha * (candidate - previous)
        if not self.constraints.validate(limited).ok:
            return previous.copy(), True
        return limited, True

    def _stage_toward_swap(
        self,
        previous: np.ndarray,
        scores: np.ndarray,
        current_heavy: np.ndarray,
        desired_heavy: np.ndarray,
        tpp_candidate: float,
        response: float,
        budget: float,
    ) -> np.ndarray:
        stage_scores = np.asarray(scores, dtype=np.float64).copy()
        incoming = ~current_heavy & desired_heavy
        outgoing = current_heavy & ~desired_heavy
        stage_scores[incoming] = 1.0
        stage_scores[outgoing] = -1.0
        low, high = self._tpp_bounds(int(current_heavy.sum()))
        stage_tpp = float(np.clip(tpp_candidate, low, high))
        stage_candidate = self._build_candidate(
            previous,
            stage_scores,
            current_heavy,
            stage_tpp,
            response,
        )
        limited, _ = self._line_limit_same_membership(
            previous,
            stage_candidate,
            budget,
        )
        self.constraints.require(limited)
        return limited

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
            raise ValueError("Invalid V2.2d continuous action")
        if previous.shape != (self.n + 1,):
            raise ValueError("Invalid V2.2d previous committed target")
        self.constraints.require(previous)
        raw = np.clip(raw, -1.0, 1.0)
        if switch_ages is None:
            switch_ages = np.full(self.n, 10_000, dtype=np.int32)
        else:
            switch_ages = np.asarray(switch_ages, dtype=np.int32)

        tier = self._tier(stress_active, elapsed_sessions)
        requested_tpp = self._requested_tpp(float(raw[0]))
        requested_count = self._requested_heavy_count(float(raw[1]))
        current_heavy = previous[:-1] > self.constraints.heavy_threshold
        current_count = int(current_heavy.sum())

        tpp_move = tier.response * (requested_tpp - float(previous[-1]))
        tpp_move = float(np.clip(tpp_move, -tier.tpp_max_step, tier.tpp_max_step))
        responsive_tpp = float(
            np.clip(float(previous[-1]) + tpp_move, self.tpp_min, self.tpp_max)
        )
        selected_count, feasible_tpp, geometry_clip = self._select_feasible_count(
            responsive_tpp,
            requested_count,
            current_count,
            tier.max_heavy_count_delta,
        )

        scores = raw[2:]
        desired_heavy = self._select_heavy(
            scores,
            current_heavy,
            selected_count,
            switch_ages,
            tier.max_membership_swaps,
        )
        selected_count = int(desired_heavy.sum())
        low, high = self._tpp_bounds(selected_count)
        if feasible_tpp < low - 1e-12 or feasible_tpp > high + 1e-12:
            feasible_tpp = float(np.clip(feasible_tpp, low, high))
            geometry_clip = True

        raw_candidate = self._build_candidate(
            previous,
            scores,
            desired_heavy,
            feasible_tpp,
            tier.response,
        )
        raw_turnover = self._turnover(previous, raw_candidate)
        same_membership = np.array_equal(desired_heavy, current_heavy)
        saturated = raw_turnover > tier.target_budget + 1e-12

        if same_membership:
            target, limited = self._line_limit_same_membership(
                previous,
                raw_candidate,
                tier.target_budget,
            )
            saturated = saturated or limited
            reason = "TARGET_BUDGET_LIMITED" if limited else "SAME_SET_UPDATE"
        else:
            alpha = min(1.0, tier.target_budget / max(raw_turnover, 1e-12))
            atomic = previous + alpha * (raw_candidate - previous)
            atomic_heavy = atomic[:-1] > self.constraints.heavy_threshold
            if self.constraints.validate(atomic).ok and np.array_equal(
                atomic_heavy, desired_heavy
            ):
                target = atomic
                reason = "ATOMIC_HEAVY_SWAP"
            else:
                target = self._stage_toward_swap(
                    previous,
                    scores,
                    current_heavy,
                    desired_heavy,
                    feasible_tpp,
                    tier.response,
                    tier.target_budget,
                )
                reason = "HEAVY_SWAP_STAGED"
                saturated = True

        turnover = self._turnover(previous, target)
        no_change = False
        no_change_band = float(self.action_cfg["target_no_change_band"])
        if reason != "ATOMIC_HEAVY_SWAP" and turnover < no_change_band:
            target = previous.copy()
            turnover = 0.0
            no_change = True

        self.constraints.require(target)
        final_heavy = target[:-1] > self.constraints.heavy_threshold
        membership_flips = int(np.count_nonzero(final_heavy != current_heavy))
        incoming_count = int(np.count_nonzero(~current_heavy & final_heavy))
        outgoing_count = int(np.count_nonzero(current_heavy & ~final_heavy))
        heavy_switches = max(incoming_count, outgoing_count)
        dynamic_tpp_min, _ = self._tpp_bounds(int(final_heavy.sum()))
        return DecodedActionV22(
            target_weights=target,
            raw_candidate=raw_candidate,
            status=reason,
            requested_heavy_count=requested_count,
            applied_heavy_count=int(final_heavy.sum()),
            heavy_sum=float(target[:-1][final_heavy].sum()),
            target_change_turnover=float(turnover),
            budget=float(tier.target_budget),
            budget_saturated=bool(saturated),
            heavy_switches=int(heavy_switches),
            dynamic_tpp_min=float(dynamic_tpp_min),
            requested_tpp=float(requested_tpp),
            applied_tpp=float(target[-1]),
            reason_primary=reason,
            no_change_applied=bool(no_change),
            geometry_clip=bool(geometry_clip),
            execution_tier=tier.name,
            membership_flips=membership_flips,
        )
