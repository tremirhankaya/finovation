from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from scipy.optimize import linprog, minimize

from fund_ml.services import EngineBundles


CASH = "CASH_TPP"

class PortfolioError(ValueError):
    pass


def parse_horizon(value: str | int) -> int:
    if isinstance(value, int):
        horizon = value
    else:
        horizon = int(str(value).upper().removesuffix("M"))
    if horizon not in {3, 6, 12}:
        raise PortfolioError("horizon must be one of 3M, 6M, 12M")
    return horizon


@dataclass
class SolvedPortfolio:
    objective_id: str
    horizon: int
    selected: list[str]
    weights: dict[str, float]
    objective_value: float
    expected_utility: float
    variance: float
    volatility: float
    universe58_beta: float
    sector_exposures: dict[str, float]
    large_position_assets: list[str]
    large_position_total_weight: float


class PortfolioEngine:
    def __init__(self, bundles: EngineBundles):
        self.bundles = bundles
        self.policy = bundles.objectives["policy"]

    @classmethod
    def load(cls, root) -> "PortfolioEngine":
        return cls(EngineBundles.load(root))

    def _validate_common(self, request: dict[str, Any]) -> tuple[int, int, int, float, float, set[str], set[str], float | None]:
        horizon = parse_horizon(request["horizon"])
        min_count = int(request["min_stock_count"])
        max_count = int(request["max_stock_count"])
        if not int(self.policy["stock_count_min"]) <= min_count <= max_count <= int(
            self.policy["stock_count_max"]
        ):
            raise PortfolioError(
                "stock-count range must stay within "
                f"{int(self.policy['stock_count_min'])}..{int(self.policy['stock_count_max'])}"
            )
        tpp_min = float(request["tpp_min_weight"])
        tpp_max = float(request["tpp_max_weight"])
        if not float(self.policy["tpp_min"]) <= tpp_min <= tpp_max <= float(
            self.policy["tpp_max"]
        ):
            raise PortfolioError("TPP range must stay within 0.05..0.15")
        mandatory = set(request.get("mandatory_assets") or [])
        excluded = set(request.get("excluded_assets") or [])
        universe = set(self.bundles.universe)
        unknown = (mandatory | excluded).difference(universe)
        if unknown:
            raise PortfolioError(f"unknown assets: {sorted(unknown)}")
        if mandatory & excluded:
            raise PortfolioError("mandatory and excluded assets overlap")
        if len(mandatory) > max_count:
            raise PortfolioError("mandatory asset count exceeds max_stock_count")
        beta_cap = request.get("max_universe58_beta")
        beta_cap = float(beta_cap) if beta_cap is not None else None
        if beta_cap is not None and beta_cap <= 0:
            raise PortfolioError("max_universe58_beta must be positive")
        return horizon, min_count, max_count, tpp_min, tpp_max, mandatory, excluded, beta_cap

    @staticmethod
    def _validate_keys(
        request: dict[str, Any], allowed: set[str], required: set[str]
    ) -> None:
        unknown = set(request).difference(allowed)
        missing = required.difference(request)
        if unknown:
            raise PortfolioError(f"unknown request fields: {sorted(unknown)}")
        if missing:
            raise PortfolioError(f"missing request fields: {sorted(missing)}")

    def _large_position_metrics(
        self, weights: dict[str, float], selected: list[str]
    ) -> tuple[list[str], float]:
        threshold = float(self.policy["large_position_threshold"])
        assets = sorted(
            asset for asset in selected if float(weights[asset]) > threshold + 1e-10
        )
        return assets, float(sum(float(weights[asset]) for asset in assets))

    def _candidate_large_sets(
        self,
        signal: pd.DataFrame,
        selected: list[str],
        bounds: list[tuple[float, float]],
        beta_cap: float | None,
    ) -> list[set[str]]:
        threshold = float(self.policy["large_position_threshold"])
        margin = float(self.policy["strict_constraint_margin"])
        cap = float(self.policy["large_position_total_max_exclusive"])
        required = {
            asset
            for asset, (low, _) in zip(selected, bounds[:-1], strict=True)
            if low > threshold + 1e-10
        }
        optional = {
            asset
            for asset, (_, high) in zip(selected, bounds[:-1], strict=True)
            if asset not in required and high >= threshold + margin
        }
        if sum(bounds[selected.index(asset)][0] for asset in required) >= cap - margin:
            return []
        max_large_count = int(math.floor((cap - margin) / (threshold + margin)))
        if len(required) > max_large_count:
            return []

        utility_order = sorted(
            optional,
            key=lambda asset: (-float(signal.loc[asset, "selection_utility"]), asset),
        )
        sector_rank = (
            signal.loc[sorted(optional)]
            .assign(
                _asset_id=lambda frame: frame.index,
                sector_rank=lambda frame: frame.groupby("sector_code")[
                    "selection_utility"
                ].rank(method="first", ascending=False)
            )
            .sort_values(
                ["sector_rank", "selection_utility", "_asset_id"],
                ascending=[True, False, True],
            )
            .index.tolist()
            if optional
            else []
        )
        orders = [utility_order, sector_rank]
        if beta_cap is not None:
            orders.append(
                sorted(
                    optional,
                    key=lambda asset: (
                        float(signal.loc[asset, "universe58_beta"]),
                        -float(signal.loc[asset, "selection_utility"]),
                        asset,
                    ),
                )
            )

        candidates: list[set[str]] = []
        seen: set[tuple[str, ...]] = set()
        max_extra = max_large_count - len(required)
        for order in orders:
            for extra_count in range(0, min(max_extra, len(order)) + 1):
                candidate = required | set(order[:extra_count])
                key = tuple(sorted(candidate))
                if key not in seen:
                    seen.add(key)
                    candidates.append(candidate)
        return candidates

    def _solve_for_large_set(
        self,
        signal: pd.DataFrame,
        selected: list[str],
        horizon: int,
        objective_id: str,
        tpp_bounds: tuple[float, float],
        beta_cap: float | None,
        base_bounds: list[tuple[float, float]],
        large_assets: set[str] | None,
    ) -> SolvedPortfolio | None:
        assets = selected + [CASH]
        definition = self.bundles.objectives["definitions"][objective_id]
        utility = np.concatenate(
            [
                signal["selection_utility"].to_numpy(dtype=float),
                [self.bundles.tpp_log_carry(horizon)],
            ]
        )
        covariance = np.zeros((len(assets), len(assets)), dtype=float)
        covariance[:-1, :-1] = self.bundles.covariance_for(selected, horizon)
        threshold = float(self.policy["large_position_threshold"])
        margin = float(self.policy["strict_constraint_margin"])
        bounds: list[tuple[float, float]] = []
        for asset, (low, high) in zip(selected, base_bounds[:-1], strict=True):
            if large_assets is None:
                bounds.append((low, high))
            elif asset in large_assets:
                bounds.append((max(low, threshold + margin), high))
            else:
                bounds.append((low, min(high, threshold)))
        bounds.append(base_bounds[-1])
        if any(low > high + 1e-12 for low, high in bounds):
            return None

        a_ub: list[np.ndarray] = []
        b_ub: list[float] = []
        sectors = signal["sector_code"]
        for sector in sorted(sectors.unique()):
            row = np.zeros(len(assets), dtype=float)
            row[: len(selected)] = sectors.eq(sector).astype(float).to_numpy()
            a_ub.append(row)
            b_ub.append(float(self.policy["sector_max"]))
        beta = np.concatenate([signal["universe58_beta"].to_numpy(dtype=float), [0.0]])
        if beta_cap is not None:
            a_ub.append(beta)
            b_ub.append(beta_cap)
        if large_assets is not None:
            large_row = np.zeros(len(assets), dtype=float)
            for asset in large_assets:
                large_row[selected.index(asset)] = 1.0
            a_ub.append(large_row)
            b_ub.append(
                float(self.policy["large_position_total_max_exclusive"]) - margin
            )
        linear = linprog(
            c=np.zeros(len(assets)),
            A_ub=np.asarray(a_ub) if a_ub else None,
            b_ub=np.asarray(b_ub) if b_ub else None,
            A_eq=np.ones((1, len(assets))),
            b_eq=np.asarray([1.0]),
            bounds=bounds,
            method="highs",
        )
        if not linear.success:
            return None
        variance_penalty = float(definition["variance_penalty"])

        def loss(weights: np.ndarray) -> float:
            return float(-weights @ utility + variance_penalty * (weights @ covariance @ weights))

        constraints: list[dict] = [
            {"type": "eq", "fun": lambda weights: float(weights.sum() - 1.0)}
        ]
        for row, limit in zip(a_ub, b_ub, strict=True):
            constraints.append(
                {
                    "type": "ineq",
                    "fun": lambda weights, r=row.copy(), b=limit: float(b - r @ weights),
                }
            )
        solved = minimize(
            loss,
            linear.x,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"maxiter": 1000, "ftol": 1e-12, "disp": False},
        )
        if not solved.success:
            return None
        weights = solved.x
        mapping = {asset: float(weight) for asset, weight in zip(assets, weights, strict=True)}
        sector_exposures = {
            str(sector): float(
                sum(mapping[asset] for asset in selected if sectors.loc[asset] == sector)
            )
            for sector in sorted(sectors.unique())
        }
        variance = float(weights @ covariance @ weights)
        large_position_assets, large_position_total_weight = self._large_position_metrics(
            mapping, selected
        )
        result = SolvedPortfolio(
            objective_id=objective_id,
            horizon=horizon,
            selected=selected,
            weights=mapping,
            objective_value=-float(solved.fun),
            expected_utility=float(weights @ utility),
            variance=variance,
            volatility=math.sqrt(max(0.0, variance)),
            universe58_beta=float(weights @ beta),
            sector_exposures=sector_exposures,
            large_position_assets=large_position_assets,
            large_position_total_weight=large_position_total_weight,
        )
        self._validate_solution(
            result, tpp_bounds, beta_cap, check_large=large_assets is not None
        )
        return result

    def _solve_selected(
        self,
        signals: pd.DataFrame,
        selected: list[str],
        horizon: int,
        objective_id: str,
        tpp_bounds: tuple[float, float],
        beta_cap: float | None,
        bound_overrides: dict[str, tuple[float, float]] | None = None,
    ) -> SolvedPortfolio | None:
        selected = sorted(set(selected))
        if not selected:
            return None
        signal = signals.set_index("instrument_id").loc[selected]
        base_bounds: list[tuple[float, float]] = [
            (bound_overrides or {}).get(
                asset,
                (float(self.policy["stock_min"]), float(self.policy["stock_max"])),
            )
            for asset in selected
        ]
        base_bounds.append((bound_overrides or {}).get(CASH, tpp_bounds))
        if any(low > high + 1e-12 for low, high in base_bounds):
            return None
        unconstrained = self._solve_for_large_set(
            signal,
            selected,
            horizon,
            objective_id,
            tpp_bounds,
            beta_cap,
            base_bounds,
            None,
        )
        if unconstrained is None:
            return None
        threshold = float(self.policy["large_position_threshold"])
        margin = float(self.policy["strict_constraint_margin"])
        cap = float(self.policy["large_position_total_max_exclusive"])
        required = {
            asset
            for asset, (low, _) in zip(selected, base_bounds[:-1], strict=True)
            if low > threshold + 1e-10
        }
        max_large_count = int(math.floor((cap - margin) / (threshold + margin)))
        inferred = sorted(
            (
                asset
                for asset in unconstrained.large_position_assets
                if base_bounds[selected.index(asset)][1] >= threshold + margin
            ),
            key=lambda asset: (
                -unconstrained.weights[asset],
                -float(signal.loc[asset, "selection_utility"]),
                asset,
            ),
        )
        inferred_set = required | set(
            asset
            for asset in inferred
            if asset not in required
        )
        if len(inferred_set) > max_large_count:
            optional_inferred = [asset for asset in inferred if asset not in required]
            inferred_set = required | set(
                optional_inferred[: max_large_count - len(required)]
            )
        attempted: set[tuple[str, ...]] = set()
        ordered_candidates = [inferred_set]
        ordered_candidates.extend(
            sorted(
                self._candidate_large_sets(
                    signal, selected, base_bounds, beta_cap
                ),
                key=lambda assets: (
                    abs(len(assets) - len(inferred_set)),
                    tuple(sorted(assets)),
                ),
            )
        )
        for large_assets in ordered_candidates:
            key = tuple(sorted(large_assets))
            if key in attempted:
                continue
            attempted.add(key)
            solved = self._solve_for_large_set(
                signal,
                selected,
                horizon,
                objective_id,
                tpp_bounds,
                beta_cap,
                base_bounds,
                large_assets,
            )
            if solved is not None:
                return solved
        return None

    def _validate_solution(
        self,
        solved: SolvedPortfolio,
        tpp_bounds: tuple[float, float],
        beta_cap: float | None,
        check_large: bool = True,
    ) -> None:
        tolerance = 2e-7
        weights = solved.weights
        if abs(sum(weights.values()) - 1.0) > tolerance:
            raise RuntimeError("Solved weights do not sum to one")
        tpp = weights[CASH]
        if not tpp_bounds[0] - tolerance <= tpp <= tpp_bounds[1] + tolerance:
            raise RuntimeError("Solved TPP weight violates request")
        equity = 1.0 - tpp
        if not float(self.policy["equity_min"]) - tolerance <= equity <= float(
            self.policy["equity_max"]
        ) + tolerance:
            raise RuntimeError("Solved equity total violates policy")
        for asset in solved.selected:
            if not float(self.policy["stock_min"]) - tolerance <= weights[asset] <= float(
                self.policy["stock_max"]
            ) + tolerance:
                raise RuntimeError(f"Solved stock bound violation: {asset}")
        if any(value > float(self.policy["sector_max"]) + tolerance for value in solved.sector_exposures.values()):
            raise RuntimeError("Solved sector cap violation")
        if check_large and solved.large_position_total_weight >= float(
            self.policy["large_position_total_max_exclusive"]
        ):
            raise RuntimeError("Solved >5% stock total violates strict policy cap")
        if beta_cap is not None and solved.universe58_beta > beta_cap + tolerance:
            raise RuntimeError("Solved beta cap violation")

    def _reason_details(
        self,
        solved: SolvedPortfolio,
        signals: pd.DataFrame,
        mandatory: set[str] | None = None,
        locked: set[str] | None = None,
        tpp_bounds: tuple[float, float] | None = None,
        beta_cap: float | None = None,
    ) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
        mandatory = mandatory or set()
        locked = locked or set()
        lookup = signals.set_index("instrument_id")
        utility_percentile = signals["selection_utility"].rank(
            pct=True, method="average"
        )
        utility_percentile.index = signals["instrument_id"]

        selected_signal = lookup.loc[solved.selected]
        stock_weights = np.asarray(
            [solved.weights[asset] for asset in solved.selected], dtype=float
        )
        covariance = self.bundles.covariance_for(solved.selected, solved.horizon)
        marginal_risk = pd.Series(
            covariance @ stock_weights,
            index=solved.selected,
            dtype=float,
        )
        low_risk_cut = float(marginal_risk.quantile(0.30))
        selected_beta = selected_signal["universe58_beta"].astype(float)
        low_beta_cut = float(selected_beta.quantile(0.30))
        nonzero_sector_exposures = [
            exposure for exposure in solved.sector_exposures.values() if exposure > 0.0
        ]
        sector_exposure_median = float(np.median(nonzero_sector_exposures))

        stock_min = float(self.policy["stock_min"])
        stock_max = float(self.policy["stock_max"])
        sector_max = float(self.policy["sector_max"])
        large_total_max = float(self.policy["large_position_total_max_exclusive"])
        tpp_low, tpp_high = tpp_bounds or (
            float(self.policy["tpp_min"]),
            float(self.policy["tpp_max"]),
        )
        active_tolerance = 2e-5
        near_tolerance = 1e-3

        reason_codes: dict[str, list[str]] = {}
        reason_texts: dict[str, list[str]] = {}

        def add(asset: str, code: str, text: str) -> None:
            if len(reason_codes[asset]) >= 3:
                return
            reason_codes[asset].append(code)
            reason_texts[asset].append(text)

        for asset in solved.weights:
            reason_codes[asset] = []
            reason_texts[asset] = []
            if asset == CASH:
                carry = float(np.expm1(self.bundles.tpp_log_carry(solved.horizon)))
                add(
                    asset,
                    "TPP_CARRY_INCLUDED",
                    f"TPP için {solved.horizon} aylık birikimli getiri yaklaşık "
                    f"{self._format_percent(carry)} hesaplandı.",
                )
                tpp_weight = solved.weights[CASH]
                if abs(tpp_weight - tpp_low) <= active_tolerance:
                    add(
                        asset,
                        "TPP_MIN_BOUND_ACTIVE",
                        "TPP ağırlığı, kullanıcının seçtiği aralığın alt sınırında: "
                        f"{self._format_percent(tpp_low)}.",
                    )
                elif abs(tpp_weight - tpp_high) <= active_tolerance:
                    add(
                        asset,
                        "TPP_MAX_BOUND_ACTIVE",
                        "TPP ağırlığı, kullanıcının seçtiği aralığın üst sınırında: "
                        f"{self._format_percent(tpp_high)}.",
                    )
                else:
                    add(
                        asset,
                        "TPP_RANGE_ALLOCATION",
                        "TPP ağırlığı, kullanıcının seçtiği aralık içinde "
                        f"{self._format_percent(tpp_weight)} oldu.",
                    )
                continue

            row = lookup.loc[asset]
            if asset in mandatory:
                add(
                    asset,
                    "MANDATORY_ASSET",
                    "Kullanıcı bu hissenin portföyde bulunmasını istedi.",
                )
            if asset in locked:
                add(
                    asset,
                    "LOCKED_EXACT_WEIGHT",
                    "Kullanıcı bu hissenin ağırlığını "
                    f"{self._format_percent(solved.weights[asset])} olarak sabitledi.",
                )

            rank_percentile = float(row["rank_percentile"])
            rank_position = int(row["rank_position"])
            central_return = float(np.expm1(float(row["q50"])))
            if rank_percentile >= 0.90:
                add(
                    asset,
                    "MODEL_RANK_TOP_10",
                    f"{solved.horizon} aylık görünümde 58 hisse arasında {rank_position}. sırada; "
                    f"ana senaryo {self._format_percent(central_return)}.",
                )
            elif rank_percentile >= 0.75:
                add(
                    asset,
                    "MODEL_RANK_TOP_25",
                    f"{solved.horizon} aylık görünümde 58 hisse arasında {rank_position}. sırada; "
                    f"ana senaryo {self._format_percent(central_return)}.",
                )
            elif float(utility_percentile.loc[asset]) >= 0.50:
                add(
                    asset,
                    "POSITIVE_MODEL_SUPPORT",
                    f"Modelin {solved.horizon} aylık ana senaryosunda getiri yaklaşık "
                    f"{self._format_percent(central_return)}.",
                )
            else:
                add(
                    asset,
                    "PORTFOLIO_RULE_FIT",
                    "Getiri tahmini üst grupta olmasa da risk ve dağılım kurallarına uyduğu için seçildi.",
                )

            weight = solved.weights[asset]
            sector = str(row["sector_code"])
            sector_label = str(self.bundles.sector_names.loc[asset]).title()
            sector_exposure = solved.sector_exposures[sector]
            if abs(weight - stock_min) <= active_tolerance:
                add(
                    asset,
                    "MIN_WEIGHT_BOUND_ACTIVE",
                    "Bu hisseye kuralların izin verdiği en düşük ağırlık verildi: "
                    f"{self._format_percent(stock_min)}.",
                )
            elif abs(weight - stock_max) <= active_tolerance:
                add(
                    asset,
                    "MAX_WEIGHT_BOUND_ACTIVE",
                    f"Bu hisse {self._format_percent(stock_max)} üst sınırına ulaştığı için "
                    "daha fazla ağırlık verilemedi.",
                )
            elif sector_exposure >= sector_max - near_tolerance:
                add(
                    asset,
                    "SECTOR_CAP_ACTIVE",
                    f"{sector_label} toplamı {self._format_percent(sector_exposure)} ile "
                    "sektör sınırına yakın.",
                )
            elif (
                asset in solved.large_position_assets
                and solved.large_position_total_weight >= large_total_max - near_tolerance
            ):
                add(
                    asset,
                    "LARGE_POSITION_CAP_ACTIVE",
                    "Yüksek ağırlıklı hisselerin toplamı %40 sınırına yakın olduğu için dağılım sınırlandı.",
                )
            elif (
                beta_cap is not None
                and solved.universe58_beta >= beta_cap - near_tolerance
                and float(row["universe58_beta"]) <= solved.universe58_beta
            ):
                add(
                    asset,
                    "BETA_LIMIT_SUPPORT",
                    "Düşük piyasa duyarlılığı, portföyün belirlenen beta sınırında kalmasını destekliyor.",
                )
            elif float(marginal_risk.loc[asset]) <= low_risk_cut:
                add(
                    asset,
                    "LOW_PORTFOLIO_RISK_CONTRIBUTION",
                    "Bu hisse, portföyün toplam riskini seçilen hisselerin çoğundan daha az artırıyor.",
                )
            elif float(row["universe58_beta"]) <= low_beta_cut:
                add(
                    asset,
                    "LOW_BETA_SUPPORT",
                    "Bu hisse, piyasa hareketlerine seçilen hisselerin çoğundan daha az duyarlı.",
                )
            elif sector_exposure <= sector_exposure_median + 1e-12:
                add(
                    asset,
                    "SECTOR_DIVERSIFICATION_SUPPORT",
                    "Bu hisse, portföyün farklı sektörlere dağılmasına yardımcı oluyor.",
                )

        return reason_codes, reason_texts

    @staticmethod
    def _format_percent(value: float) -> str:
        return f"%{value * 100:.2f}".replace(".", ",")

    def _serialize(
        self,
        solved: SolvedPortfolio,
        signals: pd.DataFrame,
        mandatory: set[str] | None = None,
        locked: set[str] | None = None,
        current: dict[str, float] | None = None,
        tpp_bounds: tuple[float, float] | None = None,
        beta_cap: float | None = None,
    ) -> dict[str, Any]:
        weights = dict(sorted(solved.weights.items()))
        reason_codes, reason_texts = self._reason_details(
            solved,
            signals,
            mandatory,
            locked,
            tpp_bounds,
            beta_cap,
        )
        return {
            "objective_id": solved.objective_id,
            "horizon": f"{solved.horizon}M",
            "weights": weights,
            "stock_count": len(solved.selected),
            "equity_weight": 1.0 - weights[CASH],
            "tpp_weight": weights[CASH],
            "expected_model_utility_log": solved.expected_utility,
            "horizon_volatility": solved.volatility,
            "universe58_beta": solved.universe58_beta,
            "sector_exposures": solved.sector_exposures,
            "large_position_threshold": float(
                self.policy["large_position_threshold"]
            ),
            "large_position_assets": solved.large_position_assets,
            "large_position_total_weight": solved.large_position_total_weight,
            "weight_semantics": "CONTINUOUS_DECIMAL_NOT_INTEGER_PERCENT",
            "objective_value": solved.objective_value,
            "reason_codes": reason_codes,
            "reason_texts": reason_texts,
            "solution_class": "DETERMINISTIC_HEURISTIC_LOCAL_SEARCH_NOT_GLOBAL_OPTIMUM",
        }

    def create(self, request: dict[str, Any]) -> dict[str, Any]:
        self._validate_keys(
            request,
            {
                "request_id",
                "horizon",
                "min_stock_count",
                "max_stock_count",
                "tpp_min_weight",
                "tpp_max_weight",
                "mandatory_assets",
                "excluded_assets",
                "max_universe58_beta",
            },
            {
                "horizon",
                "min_stock_count",
                "max_stock_count",
                "tpp_min_weight",
                "tpp_max_weight",
            },
        )
        (
            horizon,
            min_count,
            max_count,
            tpp_min,
            tpp_max,
            mandatory,
            excluded,
            beta_cap,
        ) = self._validate_common(request)
        alternatives: list[dict[str, Any]] = []
        for objective_id in self.bundles.objectives["create_objectives"]:
            signals = self.bundles.equity_signals(horizon, objective_id)
            available = signals.loc[~signals["instrument_id"].isin(excluded)].sort_values(
                ["selection_utility", "instrument_id"], ascending=[False, True]
            )
            optional = [
                asset for asset in available["instrument_id"].tolist() if asset not in mandatory
            ]
            solutions: list[SolvedPortfolio] = []
            for count in range(min_count, max_count + 1):
                if count < len(mandatory) or count > len(available):
                    continue
                selected = sorted(mandatory) + optional[: count - len(mandatory)]
                solved = self._solve_selected(
                    signals,
                    selected,
                    horizon,
                    objective_id,
                    (tpp_min, tpp_max),
                    beta_cap,
                )
                if solved is not None:
                    solutions.append(solved)
            if not solutions:
                raise PortfolioError(f"INFEASIBLE_CREATE:{objective_id}")
            best = max(
                solutions,
                key=lambda item: (
                    item.objective_value,
                    -item.volatility,
                    -len(item.selected),
                    tuple(item.selected),
                ),
            )
            signal_lookup = signals.set_index("instrument_id")["selection_utility"]
            for _ in range(2):
                selected_set = set(best.selected)
                bottom = sorted(
                    selected_set.difference(mandatory),
                    key=lambda asset: (float(signal_lookup.loc[asset]), asset),
                )[:3]
                top = [
                    asset
                    for asset in available["instrument_id"].tolist()
                    if asset not in selected_set
                ][:6]
                challengers: list[SolvedPortfolio] = []
                for remove_asset in bottom:
                    for add_asset in top:
                        candidate = sorted(
                            selected_set.difference({remove_asset}) | {add_asset}
                        )
                        solved = self._solve_selected(
                            signals,
                            candidate,
                            horizon,
                            objective_id,
                            (tpp_min, tpp_max),
                            beta_cap,
                        )
                        if solved is not None:
                            challengers.append(solved)
                if not challengers:
                    break
                challenger = max(
                    challengers,
                    key=lambda item: (
                        item.objective_value,
                        -item.volatility,
                        tuple(item.selected),
                    ),
                )
                if challenger.objective_value <= best.objective_value + 1e-12:
                    break
                best = challenger
            alternatives.append(
                self._serialize(
                    best,
                    signals,
                    mandatory=mandatory,
                    tpp_bounds=(tpp_min, tpp_max),
                    beta_cap=beta_cap,
                )
            )
        return {
            "request_id": request.get("request_id"),
            "mode": "CREATE",
            "system_date": self.bundles.project["system_date"],
            "forecast_origin": self.bundles.project["forecast_origin"],
            "alternatives": alternatives,
            "policy_config_id": self.bundles.objectives["config_id"],
        }

    def _validate_current(self, current: dict[str, float]) -> None:
        universe = set(self.bundles.universe) | {CASH}
        unknown = set(current).difference(universe)
        if unknown:
            raise PortfolioError(f"current portfolio has unknown assets: {sorted(unknown)}")
        if CASH not in current:
            raise PortfolioError("current portfolio must contain CASH_TPP")
        if abs(sum(float(value) for value in current.values()) - 1.0) > 1e-6:
            raise PortfolioError("current portfolio must sum to one; no silent normalization")
        stocks = [asset for asset in current if asset != CASH and current[asset] > 0]
        if not int(self.policy["stock_count_min"]) <= len(stocks) <= int(
            self.policy["stock_count_max"]
        ):
            raise PortfolioError("current portfolio stock count violates policy")
        if not float(self.policy["tpp_min"]) <= current[CASH] <= float(
            self.policy["tpp_max"]
        ):
            raise PortfolioError("current CASH_TPP violates policy")
        if any(
            not float(self.policy["stock_min"])
            <= current[asset]
            <= float(self.policy["stock_max"])
            for asset in stocks
        ):
            raise PortfolioError("current stock weight violates policy")
        sectors = self.bundles.sectors
        for sector in sectors.loc[stocks].unique():
            exposure = sum(current[asset] for asset in stocks if sectors.loc[asset] == sector)
            if exposure > float(self.policy["sector_max"]) + 1e-8:
                raise PortfolioError("current sector exposure violates policy")
        _, large_total = self._large_position_metrics(current, stocks)
        if large_total >= float(self.policy["large_position_total_max_exclusive"]):
            raise PortfolioError(
                "current total weight of stocks above 5% must be strictly below 40%"
            )

    def optimize(self, request: dict[str, Any]) -> dict[str, Any]:
        self._validate_keys(
            request,
            {
                "request_id",
                "horizon",
                "current_portfolio",
                "locked_assets",
                "mandatory_assets",
                "excluded_assets",
                "min_stock_count",
                "max_stock_count",
                "tpp_min_weight",
                "tpp_max_weight",
                "max_weight_change_per_asset",
                "max_additions",
                "max_removals",
                "max_universe58_beta",
            },
            {
                "horizon",
                "current_portfolio",
                "locked_assets",
                "min_stock_count",
                "max_stock_count",
                "tpp_min_weight",
                "tpp_max_weight",
                "max_weight_change_per_asset",
                "max_additions",
                "max_removals",
            },
        )
        (
            horizon,
            min_count,
            max_count,
            tpp_min,
            tpp_max,
            mandatory,
            excluded,
            beta_cap,
        ) = self._validate_common(request)
        current = {asset: float(weight) for asset, weight in request["current_portfolio"].items()}
        self._validate_current(current)
        locked = {asset: float(weight) for asset, weight in request.get("locked_assets", {}).items()}
        for asset, weight in locked.items():
            if asset not in current or abs(current[asset] - weight) > 1e-9:
                raise PortfolioError("locked asset must exactly match current portfolio")
        locked_stocks = set(locked).difference({CASH})
        locked_excluded = locked_stocks & excluded
        if locked_excluded:
            raise PortfolioError(
                f"locked and excluded assets overlap: {sorted(locked_excluded)}"
            )
        delta_limit = float(request["max_weight_change_per_asset"])
        if delta_limit <= 0:
            raise PortfolioError("max_weight_change_per_asset must be positive")
        max_additions = int(request["max_additions"])
        max_removals = int(request["max_removals"])
        if max_additions < 0 or max_removals < 0:
            raise PortfolioError("addition/removal limits must be non-negative")
        current_stocks = {asset for asset in current if asset != CASH and current[asset] > 0}
        forced_additions = mandatory.difference(current_stocks)
        forced_removals = excluded & current_stocks
        if len(forced_additions) > max_additions:
            raise PortfolioError(
                "mandatory additions exceed max_additions: "
                f"required {len(forced_additions)}, limit {max_additions}"
            )
        if len(forced_removals) > max_removals:
            raise PortfolioError(
                "excluded removals exceed max_removals: "
                f"required {len(forced_removals)}, limit {max_removals}"
            )
        available_universe = set(self.bundles.universe).difference(excluded)
        if len(available_universe) < min_count:
            raise PortfolioError(
                "excluded assets leave fewer candidates than min_stock_count"
            )
        optional_addition_budget = max_additions - len(forced_additions)
        optional_removal_budget = max_removals - len(forced_removals)
        alternatives: list[dict[str, Any]] = []
        for objective_id in self.bundles.objectives["optimize_objectives"]:
            signals = self.bundles.equity_signals(horizon, objective_id)
            lookup = signals.set_index("instrument_id")["selection_utility"]
            removable = sorted(
                [
                    asset
                    for asset in current_stocks
                    if asset not in locked_stocks
                    and asset not in mandatory
                    and asset not in forced_removals
                ],
                key=lambda asset: (float(lookup.loc[asset]), asset),
            )
            addable = sorted(
                set(self.bundles.universe)
                .difference(current_stocks)
                .difference(excluded)
                .difference(forced_additions),
                key=lambda asset: (-float(lookup.loc[asset]), asset),
            )
            solutions: list[SolvedPortfolio] = []
            for removals in range(
                0, min(optional_removal_budget, len(removable)) + 1
            ):
                removed = forced_removals | set(removable[:removals])
                for additions in range(
                    0, min(optional_addition_budget, len(addable)) + 1
                ):
                    added = forced_additions | set(addable[:additions])
                    selected = sorted(current_stocks.difference(removed) | added)
                    if not min_count <= len(selected) <= max_count:
                        continue
                    bounds: dict[str, tuple[float, float]] = {}
                    for asset in selected:
                        if asset in locked:
                            bounds[asset] = (locked[asset], locked[asset])
                        elif asset in current:
                            bounds[asset] = (
                                max(
                                    float(self.policy["stock_min"]),
                                    current[asset] - delta_limit,
                                ),
                                min(
                                    float(self.policy["stock_max"]),
                                    current[asset] + delta_limit,
                                ),
                            )
                        else:
                            bounds[asset] = (
                                float(self.policy["stock_min"]),
                                float(self.policy["stock_max"]),
                            )
                    if CASH in locked:
                        bounds[CASH] = (locked[CASH], locked[CASH])
                    else:
                        bounds[CASH] = (
                            max(tpp_min, current[CASH] - delta_limit),
                            min(tpp_max, current[CASH] + delta_limit),
                        )
                    solved = self._solve_selected(
                        signals,
                        selected,
                        horizon,
                        objective_id,
                        (tpp_min, tpp_max),
                        beta_cap,
                        bounds,
                    )
                    if solved is not None:
                        solutions.append(solved)
            if not solutions:
                raise PortfolioError(f"INFEASIBLE_OPTIMIZE:{objective_id}")
            best = max(
                solutions,
                key=lambda item: (
                    item.objective_value,
                    -item.volatility,
                    tuple(item.selected),
                ),
            )
            result = self._serialize(
                best,
                signals,
                mandatory=mandatory,
                locked=set(locked),
                current=current,
                tpp_bounds=(tpp_min, tpp_max),
                beta_cap=beta_cap,
            )
            proposed = best.weights
            all_assets = set(current) | set(proposed)
            deltas = {
                asset: float(proposed.get(asset, 0.0) - current.get(asset, 0.0))
                for asset in sorted(all_assets)
            }
            additions = sorted(set(best.selected).difference(current_stocks))
            removals = sorted(current_stocks.difference(best.selected))
            if len(additions) > max_additions or len(removals) > max_removals:
                raise RuntimeError("Solved membership change exceeds request")
            if not mandatory.issubset(best.selected):
                raise RuntimeError("Solved portfolio omits mandatory assets")
            if excluded.intersection(best.selected):
                raise RuntimeError("Solved portfolio contains excluded assets")
            retained_delta_assets = current_stocks.intersection(best.selected) | {CASH}
            if any(
                abs(deltas[asset]) > delta_limit + 2e-7
                for asset in retained_delta_assets
            ):
                raise RuntimeError("Solved retained-asset delta exceeds request")
            result.update(
                {
                    "deltas": deltas,
                    "added_assets": additions,
                    "removed_assets": removals,
                    "locked_assets": dict(sorted(locked.items())),
                    "realized_turnover_diagnostic": 0.5
                    * sum(abs(value) for value in deltas.values()),
                }
            )
            alternatives.append(result)
        return {
            "request_id": request.get("request_id"),
            "mode": "OPTIMIZE",
            "system_date": self.bundles.project["system_date"],
            "forecast_origin": self.bundles.project["forecast_origin"],
            "alternatives": alternatives,
            "policy_config_id": self.bundles.objectives["config_id"],
        }
