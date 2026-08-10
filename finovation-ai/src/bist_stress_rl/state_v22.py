from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .scenarios_v22 import ScenarioPathV22


def _safe_corr(x: np.ndarray, y: np.ndarray) -> float:
    if len(x) < 2 or float(np.std(x)) < 1e-12 or float(np.std(y)) < 1e-12:
        return 0.0
    return float(np.clip(np.corrcoef(x, y)[0, 1], -1.0, 1.0))


def _mean_pairwise_corr(returns: np.ndarray) -> float:
    if len(returns) < 3:
        return 0.0
    correlation = np.corrcoef(returns, rowvar=False)
    values = correlation[np.triu_indices(correlation.shape[0], 1)]
    values = values[np.isfinite(values)]
    return float(np.mean(values)) if len(values) else 0.0


def _rank_to_unit(values: np.ndarray) -> np.ndarray:
    order = np.argsort(values, kind="stable")
    ranks = np.empty(len(values), dtype=np.float64)
    ranks[order] = np.arange(len(values), dtype=np.float64)
    return 2.0 * ranks / max(1, len(values) - 1) - 1.0


@dataclass(frozen=True)
class StateContextV22:
    agent_weights: np.ndarray
    passive_weights: np.ndarray
    previous_target: np.ndarray
    last_pretrade_drift: np.ndarray
    agent_nav: float
    passive_nav: float
    agent_drawdown: float
    passive_drawdown: float
    previous_realized_turnover: float
    previous_commission_fraction: float
    previous_target_change: float
    target_age: int
    elapsed_sessions: int


class StateBuilderV22:
    PER_ASSET_BASE = [
        "log_return_1",
        "log_return_5",
        "log_return_20",
        "volatility_20",
        "downside_volatility_20",
        "drawdown_20",
        "market_correlation_20",
        "shrunk_downside_beta_20",
        "cross_sectional_return_5_rank",
        "previous_committed_target",
        "last_pretrade_drift",
        "passive_weight",
    ]
    ASSET_ORACLE = ["scenario_asset_loading", "scenario_loading_uncertainty"]
    ASSET_DYNAMIC = [
        "cross_sectional_return_1_rank",
        "trough_recovery_20",
        "signed_efficiency_ratio_10",
    ]
    MARKET = [
        "market_return_1",
        "market_return_5",
        "market_return_20",
        "market_volatility_20",
        "market_downside_volatility_20",
        "market_drawdown_20",
        "negative_breadth_1",
        "negative_breadth_5",
        "negative_breadth_20",
        "dispersion_1",
        "dispersion_5",
        "dispersion_20",
        "pairwise_correlation_10",
        "pairwise_correlation_20",
    ]
    FX_TPP = [
        "usdtry_return_1",
        "usdtry_return_5",
        "usdtry_return_20",
        "usdtry_volatility_20",
        "eurtry_return_5",
        "eurtry_volatility_20",
        "known_tpp_annual_rate",
        "known_tpp_interval_accrual",
        "agent_tpp_weight",
        "previous_target_tpp_weight",
        "passive_tpp_weight",
        "last_tpp_drift",
    ]
    PORTFOLIO = [
        "log_nav_relative_to_passive",
        "agent_drawdown",
        "passive_drawdown",
        "previous_realized_turnover",
        "previous_commission_fraction",
        "previous_target_change",
        "target_age",
    ]
    HEADROOM = [
        "equity_lower_headroom",
        "equity_upper_headroom",
        "tpp_lower_headroom",
        "tpp_upper_headroom",
        "minimum_stock_lower_headroom",
        "minimum_stock_upper_headroom",
        "rule4_headroom",
        "heavy_count_scaled",
    ]
    SCENARIO = [
        "stress_active",
        "scenario_s1",
        "scenario_s2",
        "severity_midpoint",
        "severity_half_width",
        "horizon_midpoint",
        "horizon_half_width",
        "expected_wave_count",
        "rebound_propensity",
        "plateau_persistence",
        "elapsed_since_alert",
        "descriptor_confidence",
    ]

    def __init__(self, config: dict):
        self.config = config
        self.tickers = list(config["universe"]["tickers"])
        self.n = len(self.tickers)
        self.clip = float(config["observation"]["clip"])
        self.include_scenario = bool(config["observation"]["include_scenario_global"])
        self.include_loading = bool(config["observation"]["include_asset_loading"])
        requested_dynamic = list(
            config["observation"].get("append_per_asset_features", [])
        )
        unknown = sorted(set(requested_dynamic) - set(self.ASSET_DYNAMIC))
        if unknown:
            raise ValueError(f"Unknown V2.2d per-asset features: {unknown}")
        self.dynamic_features = [
            feature for feature in self.ASSET_DYNAMIC if feature in requested_dynamic
        ]

    def feature_names(self) -> list[str]:
        per_asset = (
            self.PER_ASSET_BASE
            + self.dynamic_features
            + (self.ASSET_ORACLE if self.include_loading else [])
        )
        names = [f"{ticker}:{feature}" for ticker in self.tickers for feature in per_asset]
        names.extend(self.MARKET + self.FX_TPP + self.PORTFOLIO + self.HEADROOM)
        if self.include_scenario:
            names.extend(self.SCENARIO)
        return names

    def build(self, path: ScenarioPathV22, day: int, context: StateContextV22) -> np.ndarray:
        index = path.lookback + int(day)
        price_history = path.prices[: index + 1]
        returns = np.diff(np.log(price_history), axis=0)
        if len(returns) < 20:
            raise RuntimeError("V2.2 state requires 20 historical returns")
        r1 = returns[-1]
        r5 = returns[-5:].sum(axis=0)
        r20 = returns[-20:].sum(axis=0)
        vol20 = returns[-20:].std(axis=0, ddof=0)
        downside20 = np.sqrt(np.mean(np.minimum(returns[-20:], 0.0) ** 2, axis=0))
        recent_levels = price_history[-21:]
        drawdown20 = 1.0 - recent_levels[-1] / np.maximum(recent_levels.max(axis=0), 1e-12)
        market_history = path.market_returns[: index]
        market20 = market_history[-20:]
        correlations = np.asarray(
            [_safe_corr(returns[-20:, asset], market20) for asset in range(self.n)], dtype=np.float64
        )
        negative = market20 < 0
        beta = path.train_downside_beta.copy()
        if int(negative.sum()) >= 5:
            sample = np.asarray(
                [
                    np.dot(market20[negative], returns[-20:, asset][negative])
                    / max(np.dot(market20[negative], market20[negative]), 1e-12)
                    for asset in range(self.n)
                ],
                dtype=np.float64,
            )
            count = float(negative.sum())
            beta = count / (count + 8.0) * sample + 8.0 / (count + 8.0) * beta
        rank5 = _rank_to_unit(r5)
        rank1 = _rank_to_unit(r1)
        trough_recovery20 = np.clip(
            (recent_levels[-1] / np.maximum(recent_levels.min(axis=0), 1e-12) - 1.0)
            / 0.25,
            0.0,
            2.0,
        )
        returns10 = returns[-10:]
        efficiency_denominator = np.maximum(np.abs(returns10).sum(axis=0), 1e-12)
        signed_efficiency10 = np.clip(
            returns10.sum(axis=0) / efficiency_denominator,
            -1.0,
            1.0,
        )
        per_asset_columns = [
            r1 / 0.05,
            r5 / 0.10,
            r20 / 0.20,
            vol20 / 0.05,
            downside20 / 0.05,
            drawdown20 / 0.25,
            correlations,
            (beta - 1.0) / 0.75,
            rank5,
            (context.previous_target[:-1] - 0.05) / 0.05,
            context.last_pretrade_drift[:-1] / 0.02,
            (context.passive_weights[:-1] - 0.05) / 0.05,
        ]
        dynamic_columns = {
            "cross_sectional_return_1_rank": rank1,
            "trough_recovery_20": trough_recovery20,
            "signed_efficiency_ratio_10": signed_efficiency10,
        }
        per_asset_columns.extend(
            dynamic_columns[feature] for feature in self.dynamic_features
        )
        if self.include_loading:
            per_asset_columns.extend(
                [path.asset_loading, np.clip(path.asset_uncertainty / 0.30, 0.0, 2.0)]
            )
        per_asset = np.column_stack(per_asset_columns).reshape(-1)

        market_r1 = float(market_history[-1])
        market_r5 = float(market_history[-5:].sum())
        market_r20 = float(market20.sum())
        market_vol = float(np.std(market20, ddof=0))
        market_downside = float(np.sqrt(np.mean(np.minimum(market20, 0.0) ** 2)))
        market_level = np.exp(np.cumsum(np.r_[0.0, market20]))
        market_drawdown = float(1.0 - market_level[-1] / max(float(market_level.max()), 1e-12))
        negative_breadth = np.mean(returns < 0.0, axis=1)
        dispersion = np.std(returns, axis=1, ddof=0)
        market_block = np.asarray(
            [
                market_r1 / 0.05,
                market_r5 / 0.10,
                market_r20 / 0.20,
                market_vol / 0.05,
                market_downside / 0.05,
                market_drawdown / 0.25,
                2.0 * negative_breadth[-1] - 1.0,
                2.0 * float(negative_breadth[-5:].mean()) - 1.0,
                2.0 * float(negative_breadth[-20:].mean()) - 1.0,
                dispersion[-1] / 0.03,
                float(dispersion[-5:].mean()) / 0.03,
                float(dispersion[-20:].mean()) / 0.03,
                _mean_pairwise_corr(returns[-10:]),
                _mean_pairwise_corr(returns[-20:]),
            ],
            dtype=np.float64,
        )

        usd_returns = np.diff(np.log(path.usd_levels[: index + 1]))
        eur_returns = np.diff(np.log(path.eur_levels[: index + 1]))
        rate_index = min(day, path.horizon - 1)
        known_rate = float(path.tpp_known_rates[rate_index])
        accrual_days = int(path.calendar_accrual_days[rate_index])
        fx_tpp = np.asarray(
            [
                usd_returns[-1] / 0.02,
                float(usd_returns[-5:].sum()) / 0.05,
                float(usd_returns[-20:].sum()) / 0.10,
                float(usd_returns[-20:].std(ddof=0)) / 0.02,
                float(eur_returns[-5:].sum()) / 0.05,
                float(eur_returns[-20:].std(ddof=0)) / 0.02,
                (known_rate - 40.0) / 15.0,
                (known_rate / 100.0 * accrual_days / 365.0) / 0.002,
                (context.agent_weights[-1] - 0.10) / 0.05,
                (context.previous_target[-1] - 0.10) / 0.05,
                (context.passive_weights[-1] - 0.10) / 0.05,
                context.last_pretrade_drift[-1] / 0.02,
            ],
            dtype=np.float64,
        )
        portfolio = np.asarray(
            [
                np.log(context.agent_nav / max(context.passive_nav, 1e-12)) / 0.10,
                context.agent_drawdown / 0.25,
                context.passive_drawdown / 0.25,
                context.previous_realized_turnover / 0.10,
                context.previous_commission_fraction / 0.001,
                context.previous_target_change / 0.10,
                context.target_age / 20.0,
            ],
            dtype=np.float64,
        )
        equities = context.previous_target[:-1]
        tpp = float(context.previous_target[-1])
        heavy = equities > 0.05
        heavy_sum = float(equities[heavy].sum())
        equity_sum = float(equities.sum())
        headroom = np.asarray(
            [
                (equity_sum - 0.85) / 0.10,
                (0.95 - equity_sum) / 0.10,
                (tpp - 0.05) / 0.10,
                (0.15 - tpp) / 0.10,
                float(np.min(equities - 0.03)) / 0.07,
                float(np.min(0.10 - equities)) / 0.07,
                (0.40 - heavy_sum) / 0.40,
                float(heavy.sum()) / 6.0,
            ],
            dtype=np.float64,
        )
        blocks = [per_asset, market_block, fx_tpp, portfolio, headroom]
        if self.include_scenario:
            scenario = np.asarray(
                [
                    1.0 if path.stress_active else 0.0,
                    1.0 if path.family == "S1" else 0.0,
                    1.0 if path.family == "S2" else 0.0,
                    path.severity_midpoint / 0.25,
                    path.severity_half_width / 0.10,
                    path.horizon_midpoint / 50.0,
                    path.horizon_half_width / 20.0,
                    path.expected_wave_count / 2.0,
                    path.rebound_propensity,
                    path.plateau_persistence,
                    context.elapsed_sessions / max(path.horizon_midpoint, 1.0),
                    path.descriptor_confidence,
                ],
                dtype=np.float64,
            )
            blocks.append(scenario)
        observation = np.concatenate(blocks)
        expected = int(self.config["observation"]["dimension"])
        if observation.shape != (expected,) or not np.isfinite(observation).all():
            raise RuntimeError(f"Invalid V2.2 observation: {observation.shape}, expected {(expected,)}")
        return np.clip(observation, -self.clip, self.clip).astype(np.float32)

    def contract(self) -> dict:
        names = self.feature_names()
        return {
            "version": str(self.config["observation"]["version"]),
            "dimension": len(names),
            "dtype": "float32",
            "clip": self.clip,
            "feature_order": names,
            "exact_remaining_horizon_included": False,
            "scenario_global_included": self.include_scenario,
            "event_asset_loading_included": self.include_loading,
            "dynamic_per_asset_features": self.dynamic_features,
            "causal_price_cutoff": "all price features use the information-cutoff close",
        }
