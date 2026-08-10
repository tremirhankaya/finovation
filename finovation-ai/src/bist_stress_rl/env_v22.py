from __future__ import annotations

from typing import Any

import gymnasium as gym
import numpy as np

from .constraints import ProspectusConstraints
from .decoder_v22 import DecodedActionV22, DeltaFeasibleDecoderV22
from .decoder_v22d import AbsoluteFeasibleDecoderV22d
from .portfolio import PortfolioBook
from .scenarios_v22 import ScenarioLibraryV22, ScenarioPathV22
from .state_v22 import StateBuilderV22, StateContextV22


class BistStressEnvV22(gym.Env):
    """Causal daily target-weight environment for the two defined stress families."""

    metadata = {"render_modes": []}

    def __init__(
        self,
        config: dict,
        scenarios: ScenarioLibraryV22,
        *,
        split: str = "train",
        fixed_paths: list[ScenarioPathV22] | None = None,
    ) -> None:
        super().__init__()
        self.config = config
        self.scenarios = scenarios
        self.split = split
        self.fixed_paths = fixed_paths
        self.fixed_index = 0
        self.tickers = list(config["universe"]["tickers"])
        self.tpp_symbol = str(config["universe"]["tpp_symbol"])
        self.symbols = self.tickers + [self.tpp_symbol]
        self.n = len(self.tickers)
        self.constraints = ProspectusConstraints(config["constraints"], self.n)
        if str(config["action"]["version"]) == "action_v22d_absolute":
            self.decoder = AbsoluteFeasibleDecoderV22d(config)
        else:
            self.decoder = DeltaFeasibleDecoderV22(config)
        self.state_builder = StateBuilderV22(config)
        self.action_space = gym.spaces.Box(
            low=-1.0,
            high=1.0,
            shape=(int(config["action"]["raw_dimension"]),),
            dtype=np.float32,
        )
        clip = float(config["observation"]["clip"])
        self.observation_space = gym.spaces.Box(
            low=-clip,
            high=clip,
            shape=(int(config["observation"]["dimension"]),),
            dtype=np.float32,
        )
        configured = config["universe"]["initial_weights"]
        self.initial_weights = np.asarray([configured[symbol] for symbol in self.symbols], dtype=np.float64)
        self.constraints.require(self.initial_weights)
        self.path: ScenarioPathV22 | None = None
        self.book: PortfolioBook | None = None
        self.passive: PortfolioBook | None = None
        self.history: list[dict[str, Any]] = []

    def _strict_five_percent_interior(self, weights: np.ndarray) -> np.ndarray:
        """Make the legal exact-5% legacy target numerically stable after reconstruction."""
        target = np.asarray(weights, dtype=np.float64).copy()
        exact = np.isclose(target[:-1], 0.05, rtol=0.0, atol=1e-12)
        if not exact.any():
            return target
        released = float(np.count_nonzero(exact)) * 0.0001
        target[:-1][exact] = 0.0499
        receivers = np.argsort(-(0.10 - target[:-1]))
        for index in receivers:
            if released <= 1e-15:
                break
            is_heavy = target[index] > 0.05
            heavy = target[:-1] > 0.05
            heavy_room = 0.399 - float(target[:-1][heavy].sum()) if is_heavy else np.inf
            room = min(0.10 - float(target[index]), heavy_room)
            addition = min(released, max(0.0, room))
            target[index] += addition
            released -= addition
        if released > 1e-12:
            raise RuntimeError("Could not interiorize the exact-5% legacy target")
        target[-1] = 1.0 - float(target[:-1].sum())
        self.constraints.require(target)
        return target

    def reset(
        self,
        *,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        super().reset(seed=seed)
        if options and "scenario_path" in options:
            self.path = options["scenario_path"]
        elif self.fixed_paths:
            self.path = self.fixed_paths[self.fixed_index % len(self.fixed_paths)]
            self.fixed_index += 1
        else:
            scenario_seed = int(self.np_random.integers(0, 2**31 - 1))
            self.path = self.scenarios.sample(
                self.np_random, split=self.split, scenario_seed=scenario_seed
            )
        assert self.path is not None
        initial_nav = float(self.config["project"]["initial_nav_try"])
        accounting = self.config["accounting"]
        initial_prices = self.path.prices[self.path.lookback]
        self.book = PortfolioBook(
            initial_nav,
            self.initial_weights,
            initial_prices,
            float(accounting["buy_commission_rate"]),
            float(accounting["sell_commission_rate"]),
        )
        self.passive = self.book.clone()
        self.day = 0
        self.previous_target = self._strict_five_percent_interior(self.initial_weights)
        self.last_pretrade_drift = np.zeros(self.n + 1, dtype=np.float64)
        self.switch_ages = np.full(self.n, 10_000, dtype=np.int32)
        self.previous_nav = initial_nav
        self.previous_passive_nav = initial_nav
        self.peak_nav = initial_nav
        self.passive_peak_nav = initial_nav
        self.current_drawdown = 0.0
        self.current_passive_drawdown = 0.0
        self.current_mdd_gap = 0.0
        self.running_max_drawdown = 0.0
        self.passive_max_drawdown = 0.0
        self.previous_realized_turnover = 0.0
        self.previous_commission_fraction = 0.0
        self.previous_target_change = 0.0
        self.target_age = 0
        self.total_target_turnover = 0.0
        self.total_realized_turnover = 0.0
        self.total_commission = 0.0
        self.history = []
        observation = self._observation()
        return observation, {
            "family": self.path.family,
            "scenario_track": self.path.track,
            "scenario_seed": self.path.scenario_seed,
            "horizon": self.path.horizon,
            "model_id": self.config["model"]["id"],
        }

    def _context(self) -> StateContextV22:
        assert self.path is not None and self.book is not None and self.passive is not None
        prices = self.path.prices[self.path.lookback + self.day]
        agent_weights = self.book.weights(prices)
        passive_weights = self.passive.weights(prices)
        agent_nav = self.book.nav(prices)
        passive_nav = self.passive.nav(prices)
        return StateContextV22(
            agent_weights=agent_weights,
            passive_weights=passive_weights,
            previous_target=self.previous_target,
            last_pretrade_drift=self.last_pretrade_drift,
            agent_nav=agent_nav,
            passive_nav=passive_nav,
            agent_drawdown=self.current_drawdown,
            passive_drawdown=self.current_passive_drawdown,
            previous_realized_turnover=self.previous_realized_turnover,
            previous_commission_fraction=self.previous_commission_fraction,
            previous_target_change=self.previous_target_change,
            target_age=self.target_age,
            elapsed_sessions=self.day,
        )

    def _observation(self) -> np.ndarray:
        assert self.path is not None
        return self.state_builder.build(self.path, self.day, self._context())

    def _terminal_decoded(self) -> DecodedActionV22:
        equities = self.previous_target[:-1]
        heavy = equities > 0.05
        return DecodedActionV22(
            target_weights=self.previous_target.copy(),
            raw_candidate=self.previous_target.copy(),
            status="TERMINAL_MAINTENANCE",
            requested_heavy_count=int(heavy.sum()),
            applied_heavy_count=int(heavy.sum()),
            heavy_sum=float(equities[heavy].sum()),
            target_change_turnover=0.0,
            budget=0.0,
            budget_saturated=False,
            heavy_switches=0,
            dynamic_tpp_min=float(self.config["constraints"]["tpp_min"]),
            requested_tpp=float(self.previous_target[-1]),
            applied_tpp=float(self.previous_target[-1]),
            reason_primary="TERMINAL_MAINTENANCE",
            no_change_applied=True,
            geometry_clip=False,
            execution_tier="TERMINAL",
            membership_flips=0,
        )

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool, bool, dict[str, Any]]:
        if self.path is None or self.book is None or self.passive is None:
            raise RuntimeError("V2.2 environment must be reset before step")
        raw_action = np.asarray(action, dtype=np.float64).reshape(-1)
        if raw_action.shape != self.action_space.shape or not np.isfinite(raw_action).all():
            raise ValueError("Action is invalid or non-finite")
        raw_action = np.clip(raw_action, -1.0, 1.0)
        final_session = self.day == self.path.horizon - 1
        decoded = (
            self._terminal_decoded()
            if final_session
            else self.decoder.decode(
                raw_action,
                self.previous_target,
                stress_active=self.path.stress_active,
                elapsed_sessions=self.day,
                switch_ages=self.switch_ages,
            )
        )
        committed_target = decoded.target_weights.copy()
        committed_target.setflags(write=False)

        previous_price = self.path.prices[self.path.lookback + self.day]
        execution_price = self.path.prices[self.path.lookback + self.day + 1]
        units_before = self.book.units.copy()
        values_before_market = units_before * previous_price
        self.book.accrue_tpp(
            float(self.path.tpp_realized_rates[self.day]),
            int(self.path.calendar_accrual_days[self.day]),
        )
        self.passive.accrue_tpp(
            float(self.path.tpp_realized_rates[self.day]),
            int(self.path.calendar_accrual_days[self.day]),
        )
        nav_pre_trade = self.book.nav(execution_price)
        passive_nav = self.passive.nav(execution_price)
        passive_weights = self.passive.weights(execution_price)
        passive_compliance = self.constraints.validate(passive_weights)
        pretrade_weights = self.book.weights(execution_price)
        pretrade_units = self.book.units.copy()
        pretrade_values = self.book.equity_values(execution_price)
        pretrade_tpp = float(self.book.tpp_balance)
        pretrade_compliance = self.constraints.validate(pretrade_weights)
        drift = pretrade_weights - self.previous_target
        proposed_realized_turnover = 0.5 * float(np.abs(committed_target - pretrade_weights).sum())
        if proposed_realized_turnover > float(self.config["action"]["max_realized_one_way_turnover"]) + 1e-12:
            raise RuntimeError("FAIL_CLOSED: realized one-way turnover exceeded the hard maximum")
        if proposed_realized_turnover > 1e-12:
            rebalance = self.book.rebalance(committed_target, execution_price)
            commission = float(rebalance.commission)
            realized_turnover = float(rebalance.turnover)
            equity_trades = rebalance.equity_trades.copy()
        else:
            commission = 0.0
            realized_turnover = 0.0
            equity_trades = np.zeros(self.n, dtype=np.float64)
        nav = self.book.nav(execution_price)
        post_weights = self.book.weights(execution_price)
        post_compliance = self.constraints.validate(post_weights)
        if not post_compliance.ok:
            raise RuntimeError(f"FAIL_CLOSED: illegal post-trade weights {post_compliance.violations}")

        net_log_return = float(np.log(nav / self.previous_nav))
        passive_log_return = float(np.log(passive_nav / self.previous_passive_nav))
        self.peak_nav = max(self.peak_nav, nav)
        self.passive_peak_nav = max(self.passive_peak_nav, passive_nav)
        drawdown = max(0.0, 1.0 - nav / self.peak_nav)
        passive_drawdown = max(0.0, 1.0 - passive_nav / self.passive_peak_nav)
        delta_drawdown = max(0.0, drawdown - self.current_drawdown)
        mdd_gap = max(0.0, drawdown - passive_drawdown)
        delta_gap = max(0.0, mdd_gap - self.current_mdd_gap)
        reward_cfg = self.config["reward"]
        relative_component = float(reward_cfg["relative_net_log_return"]) * (
            net_log_return - passive_log_return
        )
        mdd_component = -float(reward_cfg["incremental_agent_mdd"]) * delta_drawdown
        mdd_gap_component = -float(reward_cfg["incremental_positive_mdd_gap"]) * delta_gap
        target_change_component = -float(reward_cfg["target_change"]) * float(
            decoded.target_change_turnover
        )
        reward = float(relative_component + mdd_component + mdd_gap_component + target_change_component)

        previous_heavy = self.previous_target[:-1] > 0.05
        final_heavy = post_weights[:-1] > 0.05
        changed_membership = previous_heavy != final_heavy
        self.switch_ages = np.minimum(self.switch_ages + 1, 10_000)
        self.switch_ages[changed_membership] = 0
        target_changed = decoded.target_change_turnover > 1e-12
        self.target_age = 0 if target_changed else self.target_age + 1
        maintenance_turnover = 0.5 * float(np.abs(self.previous_target - pretrade_weights).sum())
        self.total_target_turnover += float(decoded.target_change_turnover)
        self.total_realized_turnover += realized_turnover
        self.total_commission += commission

        row: dict[str, Any] = {
            "model_id": self.config["model"]["id"],
            "family": self.path.family,
            "scenario_track": self.path.track,
            "scenario_seed": int(self.path.scenario_seed),
            "scenario_day": int(self.day + 1),
            "date": self.path.dates[self.day],
            "information_cutoff": (
                self.path.information_cutoffs[self.day]
                if self.path.information_cutoffs is not None
                else f"{self.path.family}_D{self.day:03d}_CLOSE"
            ),
            "execution_date": self.path.dates[self.day],
            "stress_active": bool(self.path.stress_active),
            "elapsed_since_alert": int(self.day),
            "action_version": str(self.config["action"]["version"]),
            "segment_hidden_from_agent": self.path.segments[self.day],
            "raw_action": raw_action.astype(float).tolist(),
            "decoded_status": decoded.status,
            "decoder_reason_primary": decoded.reason_primary or decoded.status,
            "decoder_no_change_applied": bool(decoded.no_change_applied),
            "decoder_geometry_clip": bool(decoded.geometry_clip),
            "execution_tier": decoded.execution_tier or (
                "ALERT" if self.path.stress_active and self.day == 0 else "LEGACY_NORMAL"
            ),
            "requested_tpp_weight": float(
                decoded.requested_tpp
                if np.isfinite(decoded.requested_tpp)
                else decoded.raw_candidate[-1]
            ),
            "applied_tpp_weight": float(
                decoded.applied_tpp
                if np.isfinite(decoded.applied_tpp)
                else decoded.target_weights[-1]
            ),
            "requested_heavy_count": int(decoded.requested_heavy_count),
            "applied_heavy_count": int(final_heavy.sum()),
            "heavy_sum": float(post_weights[:-1][final_heavy].sum()),
            "dynamic_tpp_min": float(decoded.dynamic_tpp_min),
            "target_budget": float(decoded.budget),
            "target_budget_saturated": bool(decoded.budget_saturated),
            "heavy_switches": int(decoded.heavy_switches),
            "membership_flips": int(decoded.membership_flips),
            "nav_previous": float(self.previous_nav),
            "nav_pre_trade": float(nav_pre_trade),
            "nav": float(nav),
            "passive_nav": float(passive_nav),
            "net_log_return": net_log_return,
            "passive_log_return": passive_log_return,
            "excess_log_return": net_log_return - passive_log_return,
            "agent_drawdown": drawdown,
            "passive_drawdown": passive_drawdown,
            "running_max_drawdown": max(self.running_max_drawdown, drawdown),
            "passive_max_drawdown": max(self.passive_max_drawdown, passive_drawdown),
            "target_change_turnover": float(decoded.target_change_turnover),
            "maintenance_turnover": maintenance_turnover,
            "realized_turnover": realized_turnover,
            "commission": commission,
            "commission_nav_fraction": commission / max(nav_pre_trade, 1e-12),
            "reward_relative": relative_component,
            "reward_mdd_absolute": mdd_component,
            "reward_mdd_relative": mdd_gap_component,
            "reward_target_change": target_change_component,
            "reward": reward,
            "tpp_rate_known": float(self.path.tpp_known_rates[self.day]),
            "tpp_rate_realized": float(self.path.tpp_realized_rates[self.day]),
            "calendar_accrual_days": int(self.path.calendar_accrual_days[self.day]),
            "pretrade_legal": bool(pretrade_compliance.ok),
            "pretrade_violations": list(pretrade_compliance.violations),
            "post_trade_legal": bool(post_compliance.ok),
            "post_trade_violations": list(post_compliance.violations),
            "passive_legal": bool(passive_compliance.ok),
            "passive_violations": list(passive_compliance.violations),
            "equity_sum": float(post_weights[:-1].sum()),
            "tpp_weight": float(post_weights[-1]),
            "rule4_headroom": float(0.40 - post_weights[:-1][final_heavy].sum()),
        }
        units_after = self.book.units.copy()
        values_after = self.book.equity_values(execution_price)
        for asset_index, ticker in enumerate(self.tickers):
            trade = float(equity_trades[asset_index])
            row[f"price_t_minus_1_{ticker}"] = float(previous_price[asset_index])
            row[f"price_t_{ticker}"] = float(execution_price[asset_index])
            row[f"units_before_{ticker}"] = float(pretrade_units[asset_index])
            row[f"units_after_{ticker}"] = float(units_after[asset_index])
            row[f"value_before_{ticker}"] = float(pretrade_values[asset_index])
            row[f"value_after_{ticker}"] = float(values_after[asset_index])
            row[f"pre_weight_{ticker}"] = float(pretrade_weights[asset_index])
            row[f"previous_target_{ticker}"] = float(self.previous_target[asset_index])
            row[f"target_weight_{ticker}"] = float(committed_target[asset_index])
            row[f"weight_{ticker}"] = float(post_weights[asset_index])
            row[f"passive_weight_{ticker}"] = float(passive_weights[asset_index])
            row[f"trade_try_{ticker}"] = trade
            row[f"buy_try_{ticker}"] = max(trade, 0.0)
            row[f"sell_try_{ticker}"] = max(-trade, 0.0)
            rate = (
                float(self.config["accounting"]["buy_commission_rate"])
                if trade >= 0
                else float(self.config["accounting"]["sell_commission_rate"])
            )
            row[f"commission_try_{ticker}"] = abs(trade) * rate
        row[f"price_t_minus_1_{self.tpp_symbol}"] = 1.0
        row[f"price_t_{self.tpp_symbol}"] = 1.0
        row[f"units_before_{self.tpp_symbol}"] = pretrade_tpp
        row[f"units_after_{self.tpp_symbol}"] = float(self.book.tpp_balance)
        row[f"value_before_{self.tpp_symbol}"] = pretrade_tpp
        row[f"value_after_{self.tpp_symbol}"] = float(self.book.tpp_balance)
        row[f"pre_weight_{self.tpp_symbol}"] = float(pretrade_weights[-1])
        row[f"previous_target_{self.tpp_symbol}"] = float(self.previous_target[-1])
        row[f"target_weight_{self.tpp_symbol}"] = float(committed_target[-1])
        row[f"weight_{self.tpp_symbol}"] = float(post_weights[-1])
        row[f"passive_weight_{self.tpp_symbol}"] = float(passive_weights[-1])
        row[f"trade_try_{self.tpp_symbol}"] = float(self.book.tpp_balance - pretrade_tpp)
        row[f"buy_try_{self.tpp_symbol}"] = max(float(self.book.tpp_balance - pretrade_tpp), 0.0)
        row[f"sell_try_{self.tpp_symbol}"] = max(float(pretrade_tpp - self.book.tpp_balance), 0.0)
        row[f"commission_try_{self.tpp_symbol}"] = 0.0
        self.history.append(row)

        self.previous_target = np.asarray(committed_target, dtype=np.float64).copy()
        self.last_pretrade_drift = drift.copy()
        self.previous_nav = nav
        self.previous_passive_nav = passive_nav
        self.current_drawdown = drawdown
        self.current_passive_drawdown = passive_drawdown
        self.current_mdd_gap = mdd_gap
        self.running_max_drawdown = max(self.running_max_drawdown, drawdown)
        self.passive_max_drawdown = max(self.passive_max_drawdown, passive_drawdown)
        self.previous_realized_turnover = realized_turnover
        self.previous_commission_fraction = commission / max(nav_pre_trade, 1e-12)
        self.previous_target_change = float(decoded.target_change_turnover)
        self.day += 1
        terminated = self.day >= self.path.horizon
        info = dict(row)
        if terminated:
            initial_nav = float(self.config["project"]["initial_nav_try"])
            info.update(
                {
                    "final_return": nav / initial_nav - 1.0,
                    "passive_final_return": passive_nav / initial_nav - 1.0,
                    "excess_return": nav / initial_nav - passive_nav / initial_nav,
                    "episode_total_reward": float(sum(item["reward"] for item in self.history)),
                    "episode_total_target_turnover": self.total_target_turnover,
                    "episode_total_turnover": self.total_realized_turnover,
                    "episode_total_commission": self.total_commission,
                    "trade_days": int(sum(item["realized_turnover"] > 1e-12 for item in self.history)),
                    "target_update_days": int(
                        sum(item["target_change_turnover"] > 1e-12 for item in self.history)
                    ),
                    "episode_budget_saturation_days": int(
                        sum(bool(item["target_budget_saturated"]) for item in self.history)
                    ),
                    "episode_heavy_switches": int(
                        sum(int(item["heavy_switches"]) for item in self.history)
                    ),
                    "episode_geometry_clip_days": int(
                        sum(bool(item.get("decoder_geometry_clip", False)) for item in self.history)
                    ),
                    "episode_no_change_days": int(
                        sum(bool(item.get("decoder_no_change_applied", False)) for item in self.history)
                    ),
                    "episode_positive_reward_days": int(
                        sum(float(item["reward"]) > 0.0 for item in self.history)
                    ),
                    "episode_negative_reward_days": int(
                        sum(float(item["reward"]) < 0.0 for item in self.history)
                    ),
                    "episode_mdd_penalty_days": int(
                        sum(float(item["reward_mdd_absolute"]) < 0.0 for item in self.history)
                    ),
                    "episode_mdd_gap_penalty_days": int(
                        sum(float(item["reward_mdd_relative"]) < 0.0 for item in self.history)
                    ),
                    "episode_target_penalty_days": int(
                        sum(float(item["reward_target_change"]) < 0.0 for item in self.history)
                    ),
                    "episode_min_tpp": float(min(item["tpp_weight"] for item in self.history)),
                    "episode_max_tpp": float(max(item["tpp_weight"] for item in self.history)),
                }
            )
        observation = (
            np.zeros(self.observation_space.shape, dtype=np.float32)
            if terminated
            else self._observation()
        )
        return observation, reward, terminated, False, info
