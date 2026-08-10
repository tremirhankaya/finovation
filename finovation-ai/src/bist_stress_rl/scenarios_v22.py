from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .data_v22 import V22MarketData


def _triangular(rng: np.random.Generator, values: list[float]) -> float:
    low, mode, high = map(float, values)
    return float(rng.triangular(low, mode, high))


def _triangular_int(rng: np.random.Generator, values: list[int]) -> int:
    return int(np.clip(round(_triangular(rng, values)), int(values[0]), int(values[2])))


def _cosine_interpolate(points: list[tuple[int, float]], horizon: int) -> np.ndarray:
    normalized: dict[int, float] = {}
    for index, value in points:
        normalized[int(np.clip(index, 0, horizon))] = float(value)
    if 0 not in normalized:
        normalized[0] = 0.0
    if horizon not in normalized:
        normalized[horizon] = list(normalized.values())[-1]
    ordered = sorted(normalized.items())
    level = np.empty(horizon + 1, dtype=np.float64)
    for (left_index, left), (right_index, right) in zip(ordered[:-1], ordered[1:]):
        count = right_index - left_index
        if count <= 0:
            continue
        u = np.linspace(0.0, 1.0, count + 1)
        easing = 0.5 * (1.0 - np.cos(np.pi * u))
        level[left_index : right_index + 1] = (1.0 - easing) * left + easing * right
    return level


@dataclass(frozen=True)
class ScenarioPathV22:
    family: str
    track: str
    scenario_seed: int
    dates: list[str]
    prices: np.ndarray
    usd_levels: np.ndarray
    eur_levels: np.ndarray
    market_returns: np.ndarray
    tpp_known_rates: np.ndarray
    tpp_realized_rates: np.ndarray
    calendar_accrual_days: np.ndarray
    segments: list[str]
    lookback: int
    severity_midpoint: float
    severity_half_width: float
    horizon_midpoint: float
    horizon_half_width: float
    expected_wave_count: float
    rebound_propensity: float
    plateau_persistence: float
    descriptor_confidence: float
    asset_loading: np.ndarray
    asset_uncertainty: np.ndarray
    train_downside_beta: np.ndarray
    information_cutoffs: list[str] | None = None

    @property
    def horizon(self) -> int:
        return len(self.dates)

    @property
    def stress_active(self) -> bool:
        return self.family in {"S1", "S2"}


class ScenarioLibraryV22:
    """Two-family correlated synthetic generator with frozen validation paths."""

    def __init__(self, config: dict, market: V22MarketData):
        self.config = config
        self.market = market
        self.tickers = list(config["universe"]["tickers"])
        self.lookback = int(config["data"]["lookback_sessions"])
        family_map = config["scenario_generator"]["families"]
        self.families = list(family_map)
        probability = np.asarray(list(family_map.values()), dtype=np.float64)
        self.probability = probability / probability.sum()

    def _warmup(
        self, rng: np.random.Generator, split: str
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        source_split = split if split in {"validation", "test"} else "train"
        start = self.market.contiguous_start(rng, self.lookback, source_split)
        stop = start + self.lookback
        return (
            self.market.returns[start:stop].copy(),
            self.market.usd_returns[start:stop].copy(),
            self.market.eur_returns[start:stop].copy(),
            self.market.closes[stop].copy(),
        )

    def _targeted_blend(self, family: str, market_level: np.ndarray) -> np.ndarray:
        profile = self.market.event_profiles[family]
        event_level = np.r_[0.0, np.cumsum(profile.market_returns)]
        source_x = np.linspace(0.0, 1.0, len(event_level))
        target_x = np.linspace(0.0, 1.0, len(market_level))
        warped = np.interp(target_x, source_x, event_level)
        desired_min = abs(float(np.min(market_level)))
        warped_min = abs(float(np.min(warped)))
        if warped_min > 1e-12:
            warped *= desired_min / warped_min
        blend = float(self.config["scenario_generator"].get("targeted_low_frequency_blend", 0.25))
        return (1.0 - blend) * market_level + blend * warped

    def _s1_market(
        self, rng: np.random.Generator, horizon: int
    ) -> tuple[np.ndarray, list[str], float, float]:
        cfg = self.config["scenario_generator"]["S1"]
        drawdown = _triangular(rng, cfg["maximum_drawdown"])
        recovery = _triangular(rng, cfg["relief_recovery"])
        terminal_ratio = _triangular(rng, cfg["terminal_drawdown_ratio"])
        delay = int(rng.choice(cfg["shock_delay_values"], p=cfg["shock_delay_probabilities"]))
        shock = min(horizon - 8, delay + int(rng.integers(2, 5)))
        relief = min(horizon - 6, shock + int(rng.integers(2, 5)))
        plateau = min(horizon - 3, max(relief + 3, int(round(0.62 * horizon))))
        terminal_dd = drawdown * terminal_ratio
        plateau_dd = min(drawdown, terminal_dd + float(rng.uniform(0.00, 0.025)))
        points = [
            (0, 0.0),
            (delay, 0.0),
            (shock, float(np.log1p(-drawdown))),
            (relief, float(np.log1p(-drawdown * (1.0 - recovery)))),
            (plateau, float(np.log1p(-plateau_dd))),
            (horizon, float(np.log1p(-terminal_dd))),
        ]
        level = _cosine_interpolate(points, horizon)
        segments = []
        for day in range(horizon):
            if day < delay:
                segments.append("ALERT_DELAY")
            elif day < shock:
                segments.append("SHOCK")
            elif day < relief:
                segments.append("RELIEF")
            elif day < plateau:
                segments.append("PLATEAU")
            else:
                segments.append("WEAK_RECOVERY")
        return level, segments, drawdown, recovery

    def _s2_market(
        self, rng: np.random.Generator, horizon: int
    ) -> tuple[np.ndarray, list[str], float, float]:
        cfg = self.config["scenario_generator"]["S2"]
        first_dd = _triangular(rng, cfg["first_wave_drawdown"])
        recovery = _triangular(rng, cfg["relief_recovery"])
        terminal_dd = max(0.8 * first_dd, _triangular(rng, cfg["terminal_drawdown"]))
        offset = int(rng.choice(cfg["terminal_offset_values"], p=cfg["terminal_offset_probabilities"]))
        first_trough = max(5, int(round(0.26 * horizon)))
        relief = max(first_trough + 4, int(round(0.52 * horizon)))
        bridge = max(relief + 3, int(round(0.68 * horizon)))
        terminal_trough = max(bridge + 3, horizon - offset)
        relief_level = max(-0.01, -first_dd * (1.0 - recovery))
        terminal_level = -terminal_dd if offset == 0 else -terminal_dd * float(rng.uniform(0.93, 0.99))
        points = [
            (0, 0.0),
            (first_trough, float(np.log1p(-first_dd))),
            (relief, float(np.log1p(relief_level))),
            (bridge, float(np.log1p(-float(rng.uniform(0.00, 0.035))))),
            (terminal_trough, float(np.log1p(-terminal_dd))),
            (horizon, float(np.log1p(terminal_level))),
        ]
        level = _cosine_interpolate(points, horizon)
        segments = []
        for day in range(horizon):
            if day < first_trough:
                segments.append("FIRST_SELL_OFF")
            elif day < relief:
                segments.append("RELIEF_RALLY")
            elif day < bridge:
                segments.append("CHOPPY_BRIDGE")
            elif day < terminal_trough:
                segments.append("SECOND_SELL_OFF")
            else:
                segments.append("TERMINAL_TROUGH")
        return level, segments, terminal_dd, recovery

    def _factor_stock_returns(
        self,
        rng: np.random.Generator,
        family: str,
        market_returns: np.ndarray,
        residuals: np.ndarray,
        usd_returns: np.ndarray,
        loading_mode: str,
    ) -> np.ndarray:
        coefficients = self.market.coefficients.copy()
        initial = np.asarray(
            [self.config["universe"]["initial_weights"][ticker] for ticker in self.tickers], dtype=float
        )
        initial /= initial.sum()
        train_beta = np.clip(self.market.train_downside_beta, 0.60, 1.40)
        train_beta /= max(float(np.dot(initial, train_beta)), 1e-12)
        if family in self.market.event_profiles and loading_mode != "train_only":
            profile = self.market.event_profiles[family]
            event_beta = np.clip(1.0 + 0.30 * profile.asset_loading, 0.60, 1.40)
            event_beta /= max(float(np.dot(initial, event_beta)), 1e-12)
            downside_beta = 0.40 * train_beta + 0.60 * event_beta
        else:
            downside_beta = train_beta
        upside_beta = np.clip(coefficients[:, 2], 0.40, 1.60)
        upside_beta /= max(float(np.dot(initial, upside_beta)), 1e-12)
        result = (
            coefficients[:, 0][None, :]
            + np.minimum(market_returns, 0.0)[:, None] * downside_beta[None, :]
            + np.maximum(market_returns, 0.0)[:, None] * upside_beta[None, :]
            + usd_returns[:, None] * coefficients[:, 3][None, :]
            + residuals
        )
        clip = float(self.config["data"]["daily_log_return_clip"])
        return np.clip(result, -clip, clip)

    def _fx_path(
        self,
        rng: np.random.Generator,
        family: str,
        horizon: int,
        usd_noise: np.ndarray,
        eur_noise: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray]:
        cfg = self.config["scenario_generator"].get(family, {})
        terminal = _triangular(rng, cfg.get("usdtry_terminal", [0.0, 0.01, 0.03]))
        centered_usd = usd_noise - float(np.mean(usd_noise))
        centered_eur = eur_noise - float(np.mean(eur_noise))
        usd = 0.45 * centered_usd + float(np.log1p(terminal)) / horizon
        eur_terminal = terminal * float(rng.uniform(0.8, 1.6))
        eur = 0.45 * centered_eur + float(np.log1p(eur_terminal)) / horizon
        return usd, eur

    def _tpp_path(
        self, rng: np.random.Generator, family: str, horizon: int
    ) -> np.ndarray:
        cfg = self.config["scenario_generator"].get(family, {})
        mean = _triangular(rng, cfg.get("tpp_rate_mean", [30.0, 40.0, 50.0]))
        rates = np.empty(horizon, dtype=np.float64)
        rates[0] = mean + float(rng.normal(0.0, 0.6))
        for index in range(1, horizon):
            rates[index] = mean + 0.85 * (rates[index - 1] - mean) + float(rng.normal(0.0, 0.6))
        return np.clip(rates, 1.0, 80.0)

    def _stress_path(
        self,
        rng: np.random.Generator,
        family: str,
        split: str,
        scenario_seed: int,
    ) -> ScenarioPathV22:
        cfg = self.config["scenario_generator"][family]
        horizon = _triangular_int(rng, cfg["horizon"])
        warm_returns, warm_usd, warm_eur, start_prices = self._warmup(rng, split)
        if family == "S1":
            market_level, segments, severity, recovery = self._s1_market(rng, horizon)
            descriptor = (0.175, 0.055, 32.0, 6.0, 1.0, 0.37, 0.85)
        else:
            market_level, segments, severity, recovery = self._s2_market(rng, horizon)
            descriptor = (0.125, 0.045, 39.0, 7.0, 2.0, 0.99, 0.35)
        track = "clean_joint"
        targeted_fraction = float(self.config["scenario_generator"].get("targeted_derivative_fraction", 0.0))
        if split == "train" and float(rng.random()) < targeted_fraction:
            market_level = self._targeted_blend(family, market_level)
            market_level *= float(rng.uniform(0.85, 1.15))
            track = "targeted_light"
        market_returns = np.diff(market_level)
        residual, usd_noise, eur_noise, gaps = self.market.sample_joint_blocks(
            rng, horizon, int(self.config["data"]["residual_block_length"])
        )
        scale = float(rng.uniform(*map(float, self.config["scenario_generator"]["residual_scale"][family])))
        usd_returns, eur_returns = self._fx_path(rng, family, horizon, usd_noise, eur_noise)
        loading_mode = str(self.config["scenario_generator"].get("loading_mode", "train_only"))
        if split in {"validation", "test"}:
            loading_mode = str(
                self.config["scenario_generator"].get("evaluation_loading_mode", "event_in_generator")
            )
        stock_returns = self._factor_stock_returns(
            rng, family, market_returns, scale * residual, usd_returns, loading_mode
        )
        tpp_rates = self._tpp_path(rng, family, horizon)
        profile = self.market.event_profiles[family]
        return self._assemble(
            family=family,
            track=track,
            scenario_seed=scenario_seed,
            warm_returns=warm_returns,
            warm_usd=warm_usd,
            warm_eur=warm_eur,
            stock_returns=stock_returns,
            usd_returns=usd_returns,
            eur_returns=eur_returns,
            market_returns=market_returns,
            start_prices=start_prices,
            tpp_rates=tpp_rates,
            gaps=gaps,
            segments=segments,
            descriptor=descriptor,
            asset_loading=profile.asset_loading,
            asset_uncertainty=profile.asset_uncertainty,
        )

    def _normal_path(
        self, rng: np.random.Generator, split: str, scenario_seed: int
    ) -> ScenarioPathV22:
        low, high = map(int, self.config["scenario_generator"]["normal_horizon"])
        horizon = int(rng.integers(low, high + 1))
        source_split = split if split in {"validation", "test"} else "train"
        start = self.market.contiguous_start(rng, self.lookback + horizon, source_split)
        warm_stop = start + self.lookback
        stop = warm_stop + horizon
        stock_returns = self.market.returns[warm_stop:stop].copy()
        usd_returns = self.market.usd_returns[warm_stop:stop].copy()
        eur_returns = self.market.eur_returns[warm_stop:stop].copy()
        market_returns = self.market.market_returns[warm_stop:stop].copy()
        indices = rng.integers(0, len(self.market.tpp_rates), size=horizon)
        tpp = self.market.tpp_rates[indices].copy()
        gaps = self.market.session_accrual_days[warm_stop:stop].copy()
        return self._assemble(
            family="NORMAL",
            track="historical_normal",
            scenario_seed=scenario_seed,
            warm_returns=self.market.returns[start:warm_stop].copy(),
            warm_usd=self.market.usd_returns[start:warm_stop].copy(),
            warm_eur=self.market.eur_returns[start:warm_stop].copy(),
            stock_returns=stock_returns,
            usd_returns=usd_returns,
            eur_returns=eur_returns,
            market_returns=market_returns,
            start_prices=self.market.closes[warm_stop].copy(),
            tpp_rates=tpp,
            gaps=gaps,
            segments=["NORMAL"] * horizon,
            descriptor=(0.0, 0.0, 38.0, 10.0, 0.0, 0.0, 0.0),
            asset_loading=np.zeros(len(self.tickers), dtype=np.float64),
            asset_uncertainty=np.ones(len(self.tickers), dtype=np.float64),
        )

    def sample(
        self,
        rng: np.random.Generator,
        *,
        split: str = "train",
        forced_family: str | None = None,
        scenario_seed: int | None = None,
    ) -> ScenarioPathV22:
        seed = int(scenario_seed if scenario_seed is not None else rng.integers(0, 2**31 - 1))
        family = forced_family or str(rng.choice(self.families, p=self.probability))
        if family == "NORMAL":
            return self._normal_path(rng, split, seed)
        if family not in {"S1", "S2"}:
            raise ValueError(f"Unknown V2.2 family: {family}")
        return self._stress_path(rng, family, split, seed)

    def frozen_paths(self, split: str) -> list[ScenarioPathV22]:
        if split not in {"validation", "test"}:
            raise ValueError("Frozen V2.2 paths are validation/test only")
        key = "validation_seeds_per_family" if split == "validation" else "test_seeds_per_family"
        base_key = "validation_seed_base" if split == "validation" else "test_seed_base"
        count = int(self.config["scenario_generator"][key])
        base = int(self.config["scenario_generator"][base_key])
        paths: list[ScenarioPathV22] = []
        for family_index, family in enumerate(["S1", "S2"]):
            for offset in range(count):
                seed = base + family_index * 100_000 + offset
                paths.append(
                    self.sample(
                        np.random.default_rng(seed),
                        split=split,
                        forced_family=family,
                        scenario_seed=seed,
                    )
                )
        return paths

    def _assemble(
        self,
        *,
        family: str,
        track: str,
        scenario_seed: int,
        warm_returns: np.ndarray,
        warm_usd: np.ndarray,
        warm_eur: np.ndarray,
        stock_returns: np.ndarray,
        usd_returns: np.ndarray,
        eur_returns: np.ndarray,
        market_returns: np.ndarray,
        start_prices: np.ndarray,
        tpp_rates: np.ndarray,
        gaps: np.ndarray,
        segments: list[str],
        descriptor: tuple[float, float, float, float, float, float, float],
        asset_loading: np.ndarray,
        asset_uncertainty: np.ndarray,
    ) -> ScenarioPathV22:
        horizon = len(stock_returns)
        all_returns = np.vstack([warm_returns, stock_returns])
        prices = np.empty((len(all_returns) + 1, len(self.tickers)), dtype=np.float64)
        prices[self.lookback] = start_prices
        for index in range(self.lookback - 1, -1, -1):
            prices[index] = prices[index + 1] / np.exp(warm_returns[index])
        for target, daily in enumerate(stock_returns, start=self.lookback + 1):
            prices[target] = prices[target - 1] * np.exp(daily)
        all_usd = np.r_[warm_usd, usd_returns]
        all_eur = np.r_[warm_eur, eur_returns]
        usd_levels = np.empty(len(all_usd) + 1, dtype=np.float64)
        eur_levels = np.empty(len(all_eur) + 1, dtype=np.float64)
        usd_levels[self.lookback] = 1.0
        eur_levels[self.lookback] = 1.0
        for index in range(self.lookback - 1, -1, -1):
            usd_levels[index] = usd_levels[index + 1] / np.exp(warm_usd[index])
            eur_levels[index] = eur_levels[index + 1] / np.exp(warm_eur[index])
        for target, daily in enumerate(usd_returns, start=self.lookback + 1):
            usd_levels[target] = usd_levels[target - 1] * np.exp(daily)
        for target, daily in enumerate(eur_returns, start=self.lookback + 1):
            eur_levels[target] = eur_levels[target - 1] * np.exp(daily)
        if not np.isfinite(prices).all() or np.any(prices <= 0):
            raise RuntimeError("V2.2 generator produced invalid prices")
        severity_mid, severity_width, horizon_mid, horizon_width, waves, rebound, plateau = descriptor
        return ScenarioPathV22(
            family=family,
            track=track,
            scenario_seed=int(scenario_seed),
            dates=[f"{family}_D{day:03d}" for day in range(1, horizon + 1)],
            prices=prices,
            usd_levels=usd_levels,
            eur_levels=eur_levels,
            market_returns=np.r_[np.mean(warm_returns, axis=1), market_returns],
            tpp_known_rates=np.asarray(tpp_rates, dtype=np.float64),
            tpp_realized_rates=np.asarray(tpp_rates, dtype=np.float64),
            calendar_accrual_days=np.asarray(gaps, dtype=np.int32),
            segments=list(segments),
            lookback=self.lookback,
            severity_midpoint=float(severity_mid),
            severity_half_width=float(severity_width),
            horizon_midpoint=float(horizon_mid),
            horizon_half_width=float(horizon_width),
            expected_wave_count=float(waves),
            rebound_propensity=float(rebound),
            plateau_persistence=float(plateau),
            descriptor_confidence=0.81 if family in {"S1", "S2"} else 1.0,
            asset_loading=np.asarray(asset_loading, dtype=np.float64),
            asset_uncertainty=np.asarray(asset_uncertainty, dtype=np.float64),
            train_downside_beta=self.market.train_downside_beta.copy(),
        )
