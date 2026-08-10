from __future__ import annotations

from typing import Any, Sequence

import gymnasium as gym
import numpy as np

from .constraints import ProspectusConstraints
from .compliance import MinimumTurnoverComplianceRepair
from .decoder import FeasibleActionDecoder
from .portfolio import PortfolioBook
from .scenarios import ScenarioLibrary, ScenarioPath


class BistStressEnv(gym.Env[np.ndarray, np.ndarray]):
    """Daily stress portfolio environment with a prospectus-feasible action layer."""

    metadata = {"render_modes": []}

    def __init__(
        self,
        config: dict,
        scenarios: ScenarioLibrary,
        *,
        split: str = "train",
        fixed_paths: Sequence[ScenarioPath] | None = None,
        execution_policy: str | None = None,
        compliance_target: np.ndarray | None = None,
    ) -> None:
        super().__init__()
        self.config = config
        self.scenarios = scenarios
        self.split = split
        self.fixed_paths = list(fixed_paths or [])
        self.fixed_path_index = 0
        self.tickers = list(config["universe"]["tickers"])
        self.symbols = self.tickers + [config["universe"]["tpp_symbol"]]
        self.constraints = ProspectusConstraints(config["constraints"], len(self.tickers))
        self.decoder = FeasibleActionDecoder(config, len(self.tickers))
        allowed_execution_policies = {
            "POLICY_ORIGINAL",
            "POLICY_FORCED_ONLY",
            "MECHANICAL_MIN_TURNOVER_COMPLIANCE",
            "STATIC_TARGET_COMPLIANCE",
            "PRECOMMITTED_DAILY_LEGAL",
        }
        if execution_policy is None:
            execution_policy = str(config.get("execution", {}).get("policy", "POLICY_ORIGINAL"))
        if execution_policy not in allowed_execution_policies:
            raise ValueError(f"Unknown execution policy: {execution_policy}")
        self.execution_policy = execution_policy
        self.repairer = MinimumTurnoverComplianceRepair(config, len(self.tickers))
        self.compliance_target = None if compliance_target is None else np.asarray(compliance_target, dtype=np.float64)
        if self.execution_policy == "STATIC_TARGET_COMPLIANCE":
            if self.compliance_target is None:
                raise ValueError("STATIC_TARGET_COMPLIANCE requires a compliance target")
            self.constraints.require(self.compliance_target)
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
        self.path: ScenarioPath | None = None
        self.book: PortfolioBook | None = None
        self.passive: PortfolioBook | None = None
        self.day = 0
        self.peak_nav = 0.0
        self.passive_peak_nav = 0.0
        self.running_mdd = 0.0
        self.previous_turnover = 0.0
        self.previous_commission_fraction = 0.0
        self.previous_nav = 0.0
        self.previous_passive_nav = 0.0
        self.history: list[dict[str, Any]] = []

    def _strict_interior_target(self, weights: np.ndarray) -> np.ndarray:
        """Move exact 5% boundary weights to the operational light interior.

        A mathematically exact 5% weight is not heavy, but floating-point
        reconstruction after execution can turn it into 5% + epsilon. V2.1
        precommitted HOLD targets therefore need a deterministic interior form.
        """

        target = np.asarray(weights, dtype=np.float64).copy()
        equities = target[:-1]
        threshold = float(self.config["constraints"]["heavy_threshold_strict"])
        operational = self.config["constraints"]["operational"]
        light_max = float(operational["light_weight_max"])
        boundary = (equities > light_max + 1e-12) & (equities <= threshold + 1e-10)
        if not boundary.any():
            self.constraints.require(target)
            return target
        released = float((equities[boundary] - light_max).sum())
        equities[boundary] = light_max

        tpp_ceiling = float(self.config["constraints"]["tpp_max"]) - 1e-6
        to_tpp = min(released, max(0.0, tpp_ceiling - float(target[-1])))
        target[-1] += to_tpp
        released -= to_tpp
        if released > 1e-12:
            light = np.flatnonzero(equities < light_max - 1e-12)
            for index in light:
                addition = min(released, light_max - float(equities[index]))
                equities[index] += addition
                released -= addition
                if released <= 1e-12:
                    break
        if released > 1e-12:
            heavy = np.flatnonzero(equities > threshold)
            heavy_room = float(operational["heavy_sum_max"] - equities[heavy].sum())
            stock_max = float(self.config["constraints"]["stock_weight_max"]) - 1e-6
            for index in heavy:
                addition = min(released, heavy_room, stock_max - float(equities[index]))
                if addition > 0:
                    equities[index] += addition
                    released -= addition
                    heavy_room -= addition
                if released <= 1e-12:
                    break
        if released > 1e-10:
            raise RuntimeError("Could not place strict-boundary safety margin")
        target[:-1] = equities
        target /= target.sum()
        self.constraints.require(target)
        return target

    def reset(
        self,
        *,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        super().reset(seed=seed)
        supplied = None if options is None else options.get("scenario_path")
        if supplied is not None:
            self.path = supplied
        elif self.fixed_paths:
            self.path = self.fixed_paths[self.fixed_path_index % len(self.fixed_paths)]
            self.fixed_path_index += 1
        else:
            self.path = self.scenarios.sample(self.np_random, split=self.split)
        prices = self.path.prices[self.path.lookback]
        accounting = self.config["accounting"]
        self.book = PortfolioBook(
            float(self.config["project"]["initial_nav_try"]),
            self.initial_weights,
            prices,
            float(accounting["buy_commission_rate"]),
            float(accounting["sell_commission_rate"]),
        )
        self.passive = self.book.clone()
        self.day = 0
        self.peak_nav = self.book.nav(prices)
        self.passive_peak_nav = self.passive.nav(prices)
        self.running_mdd = 0.0
        self.previous_turnover = 0.0
        self.previous_commission_fraction = 0.0
        self.previous_nav = self.peak_nav
        self.previous_passive_nav = self.passive_peak_nav
        self.history = []
        return self._observation(), {
            "family": self.path.family,
            "scenario_seed": self.path.scenario_seed,
        }

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool, bool, dict[str, Any]]:
        if self.path is None or self.book is None or self.passive is None:
            raise RuntimeError("Environment must be reset before step")
        raw_action = np.asarray(action, dtype=np.float64)
        if not self.action_space.contains(raw_action.astype(np.float32)):
            raise ValueError("Action is outside Box(-1,1)")

        scenario_day = self.day
        final_session = scenario_day == self.path.horizon - 1
        decision_price_index = self.path.lookback + scenario_day
        decision_prices = self.path.prices[decision_price_index]
        decision_weights = self.book.weights(decision_prices)
        precommitted = self.execution_policy == "PRECOMMITTED_DAILY_LEGAL"
        precommitted_decoded = None
        if precommitted:
            self.constraints.require(decision_weights)
            decode_action = raw_action.copy()
            if bool(self.config.get("execution", {}).get("force_target_decode", False)):
                decode_action[0] = 1.0
            precommitted_decoded = self.decoder.decode(decode_action, decision_weights)
        price_index = self.path.lookback + scenario_day + 1
        prices = self.path.prices[price_index]
        annual_tpp_rate = float(self.path.tpp_annual_rates[scenario_day])
        accrual_days = int(self.path.calendar_accrual_days[scenario_day])
        self.book.accrue_tpp(annual_tpp_rate, accrual_days)
        self.passive.accrue_tpp(annual_tpp_rate, accrual_days)

        nav_before_trade = self.book.nav(prices)
        passive_nav = self.passive.nav(prices)
        weights_before = self.book.weights(prices)
        pre_trade_compliance = self.constraints.validate(weights_before)
        current_legal = pre_trade_compliance.ok
        gross_agent_log_return = float(np.log(nav_before_trade / self.previous_nav))
        passive_log_return = float(np.log(passive_nav / self.previous_passive_nav))
        relative_gross_log_return = gross_agent_log_return - passive_log_return

        decoded = precommitted_decoded or self.decoder.decode(raw_action, weights_before)
        decoder_target_weights = decoded.target_weights.copy()
        if precommitted and decoded.status == "HOLD":
            decoder_target_weights = self._strict_interior_target(decoder_target_weights)
        target_weights = decoder_target_weights.copy()
        status = decoded.status
        decoded_status = decoded.status
        repair_one_way_turnover = np.nan
        if precommitted:
            status = (
                "PRECOMMITTED_MAINTENANCE"
                if decoded.status == "HOLD"
                else "PRECOMMITTED_REBALANCE"
            )
        elif self.execution_policy == "POLICY_FORCED_ONLY" and current_legal:
            target_weights = weights_before.copy()
            status = "HOLD"
        elif self.execution_policy == "MECHANICAL_MIN_TURNOVER_COMPLIANCE":
            if current_legal:
                target_weights = weights_before.copy()
                status = "HOLD"
            else:
                repair = self.repairer.repair(weights_before)
                target_weights = repair.target_weights
                repair_one_way_turnover = repair.one_way_turnover
                status = "MECHANICAL_COMPLIANCE"
        elif self.execution_policy == "STATIC_TARGET_COMPLIANCE":
            if current_legal:
                target_weights = weights_before.copy()
                status = "HOLD"
            else:
                assert self.compliance_target is not None
                target_weights = self.compliance_target.copy()
                status = "STATIC_COMPLIANCE"
        turnover = 0.0
        commission = 0.0
        equity_trades = np.zeros(len(self.tickers), dtype=np.float64)
        execute = status != "HOLD"
        proposed_turnover = 0.5 * float(np.abs(target_weights - weights_before).sum())
        minimum_turnover = float(self.config["action"]["minimum_one_way_turnover_to_execute"])
        if precommitted:
            execute = proposed_turnover > 1e-12
            if not execute:
                status = "PRECOMMITTED_NO_TRADE"
        else:
            if final_session and current_legal:
                execute = False
                target_weights = weights_before.copy()
                status = "TERMINAL_HOLD"
            if execute and proposed_turnover < minimum_turnover and current_legal:
                execute = False
                target_weights = weights_before.copy()
                status = "MIN_TURNOVER_HOLD"
        if execute:
            result = self.book.rebalance(target_weights, prices)
            turnover = result.turnover
            commission = result.commission
            equity_trades = result.equity_trades

        nav = self.book.nav(prices)
        weights_after = self.book.weights(prices)
        compliance = self.constraints.validate(weights_after)
        if not compliance.ok:
            raise RuntimeError(f"Illegal end-of-day portfolio: {compliance.violations}")

        commission_log_cost = float(np.log(nav / nav_before_trade))
        self.peak_nav = max(self.peak_nav, nav)
        self.passive_peak_nav = max(self.passive_peak_nav, passive_nav)
        current_mdd = max(0.0, 1.0 - nav / self.peak_nav)
        passive_mdd = max(0.0, 1.0 - passive_nav / self.passive_peak_nav)
        delta_running_mdd = max(0.0, current_mdd - self.running_mdd)
        self.running_mdd = max(self.running_mdd, current_mdd)

        reward_cfg = self.config["reward"]
        alpha_component = float(reward_cfg["relative_gross_log_return_scale"]) * relative_gross_log_return
        commission_component = float(reward_cfg["commission_log_cost_scale"]) * commission_log_cost
        mdd_component = -float(reward_cfg["incremental_running_mdd_coefficient"]) * delta_running_mdd
        turnover_excess = max(0.0, turnover - float(reward_cfg["turnover_hinge"]))
        turnover_component = -float(reward_cfg["turnover_coefficient"]) * turnover_excess
        reward_raw = alpha_component + commission_component + mdd_component + turnover_component
        reward = float(np.clip(reward_raw, *map(float, reward_cfg["clip"])))
        clipping_adjustment = reward - reward_raw

        equities_after = weights_after[:-1]
        heavy_mask = equities_after > float(self.config["constraints"]["heavy_threshold_strict"])
        equities_before = weights_before[:-1]
        heavy_before_mask = equities_before > float(self.config["constraints"]["heavy_threshold_strict"])
        heavy_before_sum = float(equities_before[heavy_before_mask].sum())
        tpp_before_trade = float(weights_before[-1] * nav_before_trade)
        tpp_after_trade = float(weights_after[-1] * nav)
        record: dict[str, Any] = {
            "scenario_day": scenario_day + 1,
            "date": self.path.dates[scenario_day],
            "family": self.path.family,
            "scenario_seed": self.path.scenario_seed,
            "segment": self.path.segments[scenario_day],
            "action_status": status,
            "decoded_status": decoded_status,
            "execution_policy": self.execution_policy,
            "raw_action": raw_action.astype(float).tolist(),
            "policy_gate_value": float(raw_action[0]),
            "requested_heavy_count": decoded.requested_heavy_count,
            "applied_heavy_count": int(heavy_mask.sum()),
            "heavy_sum": float(equities_after[heavy_mask].sum()),
            "tpp_rate": annual_tpp_rate,
            "calendar_accrual_days": accrual_days,
            "decision_information_price_index": decision_price_index,
            "execution_price_index": price_index,
            "compliance_check_price_index": price_index,
            "decision_target_precommitted": precommitted,
            "forced_trigger_uses_execution_close": bool(not current_legal and execute and not precommitted),
            "final_session": final_session,
            "pre_trade_legal": current_legal,
            "pre_trade_violations": list(pre_trade_compliance.violations),
            "pre_trade_heavy_sum": heavy_before_sum,
            "pre_trade_heavy_headroom_strict": float(
                self.config["constraints"]["heavy_sum_strict_max"] - heavy_before_sum
            ),
            "pre_trade_tpp_min_headroom": float(
                weights_before[-1] - self.config["constraints"]["tpp_min"]
            ),
            "pre_trade_tpp_max_headroom": float(
                self.config["constraints"]["tpp_max"] - weights_before[-1]
            ),
            "pre_trade_stock_min_headroom": float(
                equities_before.min() - self.config["constraints"]["stock_weight_min"]
            ),
            "pre_trade_stock_max_headroom": float(
                self.config["constraints"]["stock_weight_max"] - equities_before.max()
            ),
            "nav_before_trade": nav_before_trade,
            "nav": nav,
            "passive_nav": passive_nav,
            "gross_agent_log_return": gross_agent_log_return,
            "passive_log_return": passive_log_return,
            "relative_gross_log_return": relative_gross_log_return,
            "drawdown": current_mdd,
            "passive_drawdown": passive_mdd,
            "running_max_drawdown": self.running_mdd,
            "delta_running_mdd": delta_running_mdd,
            "turnover": turnover,
            "proposed_turnover": proposed_turnover,
            "repair_one_way_turnover": repair_one_way_turnover,
            "commission": commission,
            "alpha_reward_component": alpha_component,
            "commission_reward_component": commission_component,
            "mdd_reward_component": mdd_component,
            "turnover_reward_component": turnover_component,
            "reward_clipping_adjustment": clipping_adjustment,
            "reward_raw": reward_raw,
            "reward": reward,
            "post_trade_legal": compliance.ok,
        }
        for index, symbol in enumerate(self.symbols):
            record[f"decision_weight_{symbol}"] = float(decision_weights[index])
            record[f"pre_weight_{symbol}"] = float(weights_before[index])
            record[f"target_weight_{symbol}"] = float(target_weights[index])
            record[f"decoder_target_weight_{symbol}"] = float(decoder_target_weights[index])
            record[f"weight_{symbol}"] = float(weights_after[index])
        for index, ticker in enumerate(self.tickers):
            record[f"trade_try_{ticker}"] = float(equity_trades[index])
        record[f"trade_try_{self.config['universe']['tpp_symbol']}"] = tpp_after_trade - tpp_before_trade
        self.history.append(record)

        self.previous_turnover = turnover
        self.previous_commission_fraction = commission / max(nav_before_trade, 1e-12)
        self.previous_nav = nav
        self.previous_passive_nav = passive_nav
        self.day += 1
        terminated = self.day >= self.path.horizon
        info = dict(record)
        info.update(
            {
                "total_reward": float(sum(row["reward"] for row in self.history)),
                "episode_total_turnover": float(sum(row["turnover"] for row in self.history)),
                "episode_total_commission": float(sum(row["commission"] for row in self.history)),
                "trade_days": int(sum(row["turnover"] > 0 for row in self.history)),
                "final_return": nav / float(self.config["project"]["initial_nav_try"]) - 1.0,
                "passive_final_return": passive_nav / float(self.config["project"]["initial_nav_try"]) - 1.0,
                "passive_max_drawdown": max(row["passive_drawdown"] for row in self.history),
            }
        )
        observation = (
            np.zeros(self.observation_space.shape, dtype=np.float32)
            if terminated
            else self._observation()
        )
        return observation, reward, terminated, False, info

    @staticmethod
    def _window_metrics(levels: np.ndarray) -> tuple[np.ndarray, ...]:
        logs = np.log(levels)
        ret1 = logs[-1] - logs[-2]
        ret5 = logs[-1] - logs[-6]
        ret20 = logs[-1] - logs[-21]
        daily = np.diff(logs[-21:], axis=0)
        volatility = daily.std(axis=0, ddof=0)
        drawdown = 1.0 - levels[-1] / levels[-21:].max(axis=0)
        return ret1, ret5, ret20, volatility, drawdown

    def _observation(self) -> np.ndarray:
        assert self.path is not None and self.book is not None and self.passive is not None
        index = self.path.lookback + self.day
        prices = self.path.prices[: index + 1]
        ret1, ret5, ret20, vol20, drawdown20 = self._window_metrics(prices)
        agent_weights = self.book.weights(prices[-1])
        passive_weights = self.passive.weights(prices[-1])
        per_equity_features = [
            ret1 / 0.05,
            ret5 / 0.10,
            ret20 / 0.25,
            vol20 / 0.05,
            drawdown20 / 0.25,
            agent_weights[:-1] / 0.10,
        ]
        observation_version = str(self.config["observation"]["version"])
        if observation_version == "state_v3":
            per_equity_features.append(passive_weights[:-1] / 0.10)
        per_equity = np.column_stack(per_equity_features).reshape(-1)

        market_levels = np.exp(np.log(prices).mean(axis=1))[:, None]
        market = np.asarray(self._window_metrics(market_levels)).reshape(5) / np.asarray(
            [0.05, 0.10, 0.25, 0.05, 0.25]
        )
        fx_levels = self.path.fx_levels[: index + 1, None]
        fx_ret1, fx_ret5, _, fx_vol20, _ = self._window_metrics(fx_levels)
        fx = np.asarray([fx_ret1.item() / 0.03, fx_ret5.item() / 0.06, fx_vol20.item() / 0.02])
        rate_index = min(self.day, self.path.horizon - 1)
        nav = self.book.nav(prices[-1])
        passive_nav = self.passive.nav(prices[-1])
        agent_drawdown = 1.0 - nav / max(self.peak_nav, 1e-12)
        passive_drawdown = 1.0 - passive_nav / max(self.passive_peak_nav, 1e-12)
        global_features = [
            *market,
            *fx,
            self.path.tpp_annual_rates[rate_index] / 50.0,
            agent_weights[-1] / 0.15,
        ]
        if observation_version == "state_v3":
            global_features.append(passive_weights[-1] / 0.15)
        global_features.append(np.log(nav / float(self.config["project"]["initial_nav_try"])) / 0.25)
        if observation_version == "state_v3":
            global_features.append(np.log(nav / passive_nav) / 0.10)
        global_features.append(agent_drawdown / 0.25)
        if observation_version == "state_v3":
            global_features.append(passive_drawdown / 0.25)
        global_features.extend(
            [
                self.previous_turnover / 0.10,
                self.previous_commission_fraction / 0.001,
                self.path.calendar_accrual_days[rate_index] / 4.0,
                (self.path.horizon - self.day) / float(self.path.horizon),
            ]
        )
        globals_ = np.asarray(global_features, dtype=np.float64)
        observation = np.concatenate([per_equity, globals_])
        if observation.shape != self.observation_space.shape or not np.isfinite(observation).all():
            raise RuntimeError(f"Invalid observation: shape={observation.shape}")
        clip = float(self.config["observation"]["clip"])
        return np.clip(observation, -clip, clip).astype(np.float32)
