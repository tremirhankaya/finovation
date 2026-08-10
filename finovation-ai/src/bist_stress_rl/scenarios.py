from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .data import HistoricalMarket


@dataclass
class ScenarioPath:
    family: str
    scenario_seed: int | None
    dates: list[str]
    prices: np.ndarray
    fx_levels: np.ndarray
    tpp_annual_rates: np.ndarray
    calendar_accrual_days: np.ndarray
    segments: list[str]
    lookback: int

    @property
    def horizon(self) -> int:
        return len(self.dates)


class ScenarioLibrary:
    """Train-only synthetic generator with frozen validation/test path support."""

    def __init__(self, config: dict, market: HistoricalMarket):
        self.config = config
        self.market = market
        self.tickers = list(config["universe"]["tickers"])
        self.lookback = int(config["data"]["lookback_sessions"])
        self.horizon = int(config["scenario_generator"]["horizon_sessions"])
        family_map = config["scenario_generator"]["families"]
        self.families = list(family_map)
        probabilities = np.asarray(list(family_map.values()), dtype=np.float64)
        self.probabilities = probabilities / probabilities.sum()

    @staticmethod
    def _smoothstep(value: np.ndarray) -> np.ndarray:
        clipped = np.clip(value, 0.0, 1.0)
        return clipped * clipped * (3.0 - 2.0 * clipped)

    def _market_stress_returns(
        self, rng: np.random.Generator, family: str
    ) -> tuple[np.ndarray, list[str]]:
        cfg = self.config["scenario_generator"]
        horizon = self.horizon
        start = int(rng.integers(int(cfg["crash_start_session"][0]), int(cfg["crash_start_session"][1]) + 1))
        duration = int(
            rng.integers(int(cfg["decline_duration_sessions"][0]), int(cfg["decline_duration_sessions"][1]) + 1)
        )
        bottom = min(horizon - 2, start + duration)
        target_mdd = float(rng.uniform(*map(float, cfg["maximum_drawdown"])))
        trough = float(np.log1p(-target_mdd))
        level = np.zeros(horizon + 1, dtype=np.float64)
        decline_index = np.arange(start, bottom + 1)
        decline_fraction = (decline_index - start) / max(1, bottom - start)
        level[decline_index] = trough * self._smoothstep(decline_fraction)
        level[bottom:] = trough
        if family == "V_SHAPE":
            recovery = float(rng.uniform(0.60, 1.00))
        elif family == "L_SHAPE":
            recovery = float(rng.uniform(0.00, 0.20))
        elif family == "STRAIGHT_CRASH":
            recovery = float(rng.uniform(0.00, 0.10))
            rapid_bottom = min(horizon - 2, start + max(5, duration // 2))
            decline_index = np.arange(start, rapid_bottom + 1)
            decline_fraction = (decline_index - start) / max(1, rapid_bottom - start)
            level[start:] = trough
            level[decline_index] = trough * self._smoothstep(decline_fraction)
            bottom = rapid_bottom
        else:
            recovery = float(rng.uniform(0.20, 0.50))
        if bottom < horizon:
            recovery_index = np.arange(bottom, horizon + 1)
            recovery_fraction = (recovery_index - bottom) / max(1, horizon - bottom)
            level[recovery_index] = trough * (1.0 - recovery * self._smoothstep(recovery_fraction))
        if family == "CHOPPY_DRAWDOWN":
            phase = np.arange(horizon + 1, dtype=np.float64)
            envelope = np.sin(np.pi * np.clip((phase - start) / max(1, horizon - start), 0.0, 1.0))
            level += 0.012 * envelope * np.sin(phase * float(rng.uniform(0.55, 0.90)))
            level[:start] = 0.0
        market_returns = np.diff(level)
        segments = []
        for day in range(horizon):
            if day < start:
                segments.append("PRE_STRESS")
            elif day < bottom:
                segments.append("DECLINE")
            elif recovery > 0.25:
                segments.append("RECOVERY")
            else:
                segments.append("BOTTOM_REGIME")
        return market_returns, segments

    def _stress_path(
        self, rng: np.random.Generator, family: str, scenario_seed: int | None
    ) -> ScenarioPath:
        cfg = self.config["scenario_generator"]
        warmup_start = self.market.contiguous_start(rng, self.lookback, "train")
        warmup_returns = self.market.returns[warmup_start : warmup_start + self.lookback].copy()
        warmup_fx = self.market.fx_returns[warmup_start : warmup_start + self.lookback].copy()
        start_prices = self.market.closes[warmup_start + self.lookback].copy()
        market_returns, segments = self._market_stress_returns(rng, family)
        residual = self.market.sample_joint_residuals(
            rng, self.horizon, int(self.config["data"]["residual_block_length"])
        )
        residual_scale = float(rng.uniform(*map(float, cfg["residual_scale"])))
        fx_base_parts = []
        while sum(len(part) for part in fx_base_parts) < self.horizon:
            start = self.market.contiguous_start(rng, int(self.config["data"]["residual_block_length"]), "train")
            block = int(self.config["data"]["residual_block_length"])
            fx_base_parts.append(self.market.fx_returns[start : start + block])
        fx_base = np.concatenate(fx_base_parts)[: self.horizon]
        fx_loading = float(rng.uniform(*map(float, cfg["fx_stress_loading"])))
        fx_scenario = 0.35 * fx_base + fx_loading * np.maximum(-market_returns, 0.0)
        design = np.column_stack(
            [
                np.ones(self.horizon),
                np.minimum(market_returns, 0.0),
                np.maximum(market_returns, 0.0),
                fx_scenario,
            ]
        )
        scenario_returns = design @ self.market.model_coefficients + residual_scale * residual
        clip = float(self.config["data"]["daily_log_return_clip"])
        scenario_returns = np.clip(scenario_returns, -clip, clip)
        tpp_rates, accrual_days = self.market.sample_tpp(rng, self.horizon)
        return self._assemble(
            family,
            scenario_seed,
            warmup_returns,
            warmup_fx,
            scenario_returns,
            fx_scenario,
            start_prices,
            tpp_rates,
            accrual_days,
            segments,
        )

    def _normal_path(self, rng: np.random.Generator, scenario_seed: int | None) -> ScenarioPath:
        total = self.lookback + self.horizon
        start = self.market.contiguous_start(rng, total, "train")
        returns = self.market.returns[start : start + total]
        fx_returns = self.market.fx_returns[start : start + total]
        start_prices = self.market.closes[start + self.lookback]
        tpp_rates, accrual_days = self.market.sample_tpp(rng, self.horizon)
        return self._assemble(
            "NORMAL_HISTORICAL",
            scenario_seed,
            returns[: self.lookback],
            fx_returns[: self.lookback],
            returns[self.lookback :],
            fx_returns[self.lookback :],
            start_prices,
            tpp_rates,
            accrual_days,
            ["NORMAL"] * self.horizon,
        )

    def sample(
        self,
        rng: np.random.Generator,
        *,
        split: str = "train",
        forced_family: str | None = None,
        scenario_seed: int | None = None,
    ) -> ScenarioPath:
        if split == "train" and forced_family is None:
            if float(rng.random()) > float(self.config["scenario_generator"]["synthetic_stress_probability"]):
                return self._normal_path(rng, scenario_seed)
        family = forced_family or str(rng.choice(self.families, p=self.probabilities))
        if family not in self.families:
            raise ValueError(f"Unknown scenario family: {family}")
        return self._stress_path(rng, family, scenario_seed)

    def frozen_paths(self, split: str) -> list[ScenarioPath]:
        if split not in {"validation", "test"}:
            raise ValueError("Frozen paths exist only for validation or test")
        count_key = "validation_seeds_per_family" if split == "validation" else "test_seeds_per_family"
        per_family = int(self.config["scenario_generator"][count_key])
        default_base = 400_000 if split == "validation" else 900_000
        base_key = "validation_seed_base" if split == "validation" else "test_seed_base"
        base = int(self.config["scenario_generator"].get(base_key, default_base))
        paths: list[ScenarioPath] = []
        for family_index, family in enumerate(self.families):
            for offset in range(per_family):
                seed = base + family_index * 10_000 + offset
                paths.append(self.sample(np.random.default_rng(seed), split=split, forced_family=family, scenario_seed=seed))
        return paths

    def _assemble(
        self,
        family: str,
        scenario_seed: int | None,
        warmup_returns: np.ndarray,
        warmup_fx_returns: np.ndarray,
        scenario_returns: np.ndarray,
        scenario_fx_returns: np.ndarray,
        start_prices: np.ndarray,
        tpp_rates: np.ndarray,
        accrual_days: np.ndarray,
        segments: list[str],
    ) -> ScenarioPath:
        all_returns = np.vstack([warmup_returns, scenario_returns])
        prices = np.empty((len(all_returns) + 1, len(self.tickers)), dtype=np.float64)
        prices[self.lookback] = start_prices
        for index in range(self.lookback - 1, -1, -1):
            prices[index] = prices[index + 1] / np.exp(warmup_returns[index])
        for target, daily in enumerate(scenario_returns, start=self.lookback + 1):
            prices[target] = prices[target - 1] * np.exp(daily)
        fx_levels = np.empty(len(all_returns) + 1, dtype=np.float64)
        fx_levels[self.lookback] = 1.0
        for index in range(self.lookback - 1, -1, -1):
            fx_levels[index] = fx_levels[index + 1] / np.exp(warmup_fx_returns[index])
        for target, daily in enumerate(scenario_fx_returns, start=self.lookback + 1):
            fx_levels[target] = fx_levels[target - 1] * np.exp(daily)
        if not np.isfinite(prices).all() or np.any(prices <= 0):
            raise RuntimeError("Scenario generator produced invalid prices")
        return ScenarioPath(
            family=family,
            scenario_seed=scenario_seed,
            dates=[f"SYN_D{day:03d}" for day in range(1, self.horizon + 1)],
            prices=prices,
            fx_levels=fx_levels,
            tpp_annual_rates=np.asarray(tpp_rates, dtype=np.float64),
            calendar_accrual_days=np.asarray(accrual_days, dtype=np.int32),
            segments=list(segments),
            lookback=self.lookback,
        )
