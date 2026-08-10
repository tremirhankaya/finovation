from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import linprog

from .constraints import ProspectusConstraints


@dataclass(frozen=True)
class ComplianceRepairResult:
    target_weights: np.ndarray
    one_way_turnover: float
    heavy_count: int
    heavy_indices: tuple[int, ...]


class MinimumTurnoverComplianceRepair:
    """Deterministic L1-minimum prospectus repair for a drifted portfolio.

    For a fixed heavy count, the turnover-minimising heavy set is formed by the
    largest current equity weights because all equities share the same bounds.
    Each candidate count is solved as a linear program and the feasible solution
    with the smallest one-way turnover is returned.
    """

    def __init__(self, config: dict, equity_count: int):
        self.config = config
        self.equity_count = int(equity_count)
        self.constraints = ProspectusConstraints(config["constraints"], equity_count)
        constraints = config["constraints"]
        operational = constraints["operational"]
        self.stock_min = float(constraints["stock_weight_min"])
        self.stock_max = float(constraints["stock_weight_max"])
        self.tpp_min = float(constraints["tpp_min"])
        self.tpp_max = float(constraints["tpp_max"])
        self.light_max = float(operational["light_weight_max"])
        self.heavy_min = float(operational["heavy_weight_min"])
        self.heavy_sum_max = float(operational["heavy_sum_max"])
        self.heavy_count_min = int(operational["heavy_count_min"])
        self.heavy_count_max = int(operational["heavy_count_max"])

    def _solve_for_count(self, current: np.ndarray, count: int) -> ComplianceRepairResult | None:
        asset_count = self.equity_count + 1
        heavy = np.argsort(-current[:-1], kind="stable")[:count]
        heavy_set = set(int(index) for index in heavy)

        # Variables are [target weights, absolute deviations].
        variable_count = 2 * asset_count
        objective = np.r_[np.zeros(asset_count), 0.5 * np.ones(asset_count)]
        bounds: list[tuple[float | None, float | None]] = []
        for index in range(self.equity_count):
            bounds.append(
                (self.heavy_min, self.stock_max)
                if index in heavy_set
                else (self.stock_min, self.light_max)
            )
        bounds.append((self.tpp_min, self.tpp_max))
        bounds.extend([(0.0, None)] * asset_count)

        rows: list[np.ndarray] = []
        rhs: list[float] = []
        for index in range(asset_count):
            positive = np.zeros(variable_count, dtype=np.float64)
            positive[index] = 1.0
            positive[asset_count + index] = -1.0
            rows.append(positive)
            rhs.append(float(current[index]))

            negative = np.zeros(variable_count, dtype=np.float64)
            negative[index] = -1.0
            negative[asset_count + index] = -1.0
            rows.append(negative)
            rhs.append(float(-current[index]))

        heavy_row = np.zeros(variable_count, dtype=np.float64)
        heavy_row[list(heavy_set)] = 1.0
        rows.append(heavy_row)
        rhs.append(self.heavy_sum_max)

        equality = np.zeros((1, variable_count), dtype=np.float64)
        equality[0, :asset_count] = 1.0
        solution = linprog(
            objective,
            A_ub=np.asarray(rows),
            b_ub=np.asarray(rhs),
            A_eq=equality,
            b_eq=np.asarray([1.0]),
            bounds=bounds,
            method="highs",
        )
        if not solution.success:
            return None
        target = np.asarray(solution.x[:asset_count], dtype=np.float64)
        # Remove solver-scale residuals without changing the heavy/light class.
        target[-1] += 1.0 - float(target.sum())
        validation = self.constraints.validate(target)
        if not validation.ok:
            return None
        return ComplianceRepairResult(
            target_weights=target,
            one_way_turnover=0.5 * float(np.abs(target - current).sum()),
            heavy_count=count,
            heavy_indices=tuple(sorted(heavy_set)),
        )

    def repair(self, current_weights: np.ndarray) -> ComplianceRepairResult:
        current = np.asarray(current_weights, dtype=np.float64)
        if current.shape != (self.equity_count + 1,) or not np.isfinite(current).all():
            raise ValueError("Invalid current weights for compliance repair")
        if self.constraints.validate(current).ok:
            equities = current[:-1]
            heavy = np.flatnonzero(equities > self.constraints.heavy_threshold)
            return ComplianceRepairResult(
                target_weights=current.copy(),
                one_way_turnover=0.0,
                heavy_count=int(len(heavy)),
                heavy_indices=tuple(int(index) for index in heavy),
            )

        candidates = [
            result
            for count in range(self.heavy_count_min, self.heavy_count_max + 1)
            if (result := self._solve_for_count(current, count)) is not None
        ]
        if not candidates:
            raise RuntimeError("No feasible minimum-turnover prospectus repair")
        return min(candidates, key=lambda item: (item.one_way_turnover, item.heavy_count, item.heavy_indices))
