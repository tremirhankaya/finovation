from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np


@dataclass(frozen=True)
class ConstraintResult:
    ok: bool
    violations: tuple[str, ...]


class ProspectusConstraints:
    """Fail-closed validator for 16 equities plus TPP.

    The heavy rule is intentionally count-agnostic: every equity strictly above
    5% participates in the heavy sum, and that sum must stay strictly below 40%.
    """

    def __init__(self, config: dict, equity_count: int):
        self.equity_count = int(equity_count)
        self.equity_sum_min = float(config["equity_sum_min"])
        self.equity_sum_max = float(config["equity_sum_max"])
        self.tpp_min = float(config["tpp_min"])
        self.tpp_max = float(config["tpp_max"])
        self.stock_min = float(config["stock_weight_min"])
        self.stock_max = float(config["stock_weight_max"])
        self.heavy_threshold = float(config["heavy_threshold_strict"])
        self.heavy_sum_max = float(config["heavy_sum_strict_max"])
        self.active_count = int(config["active_equity_count"])
        self.tolerance = float(config["sum_tolerance"])

    def validate(self, weights: Iterable[float]) -> ConstraintResult:
        values = np.asarray(list(weights), dtype=np.float64)
        if values.shape != (self.equity_count + 1,):
            return ConstraintResult(False, ("shape",))
        if not np.isfinite(values).all():
            return ConstraintResult(False, ("non_finite",))
        failures: list[str] = []
        equities = values[:-1]
        tpp = float(values[-1])
        tol = self.tolerance
        equity_sum = float(equities.sum())
        heavy_sum = float(equities[equities > self.heavy_threshold].sum())
        if abs(float(values.sum()) - 1.0) > tol:
            failures.append("sum")
        if not self.equity_sum_min - tol <= equity_sum <= self.equity_sum_max + tol:
            failures.append("equity_sum")
        if not self.tpp_min - tol <= tpp <= self.tpp_max + tol:
            failures.append("tpp")
        if np.any(equities < self.stock_min - tol):
            failures.append("stock_min")
        if np.any(equities > self.stock_max + tol):
            failures.append("stock_max")
        if heavy_sum >= self.heavy_sum_max - tol:
            failures.append("heavy_sum")
        if int(np.count_nonzero(equities > tol)) != self.active_count:
            failures.append("active_count")
        return ConstraintResult(not failures, tuple(failures))

    def require(self, weights: Iterable[float]) -> None:
        result = self.validate(weights)
        if not result.ok:
            raise ValueError(f"Prospectus violation: {', '.join(result.violations)}")
