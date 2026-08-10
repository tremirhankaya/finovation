from __future__ import annotations

import hashlib
import json
import threading
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from stable_baselines3 import PPO

from bist_stress_rl.config import load_config
from bist_stress_rl.constraints import ProspectusConstraints
from bist_stress_rl.data_v22 import V22MarketData
from bist_stress_rl.env_v22 import BistStressEnvV22
from bist_stress_rl.evaluate_v22 import run_episode
from bist_stress_rl.historical_v22 import build_historical_path
from bist_stress_rl.runtime_v22 import RuntimeV22
from bist_stress_rl.scenarios_v22 import ScenarioLibraryV22, ScenarioPathV22


EQUITIES = (
    "GARAN.E",
    "AKBNK.E",
    "ASELS.E",
    "BIMAS.E",
    "TUPRS.E",
    "THYAO.E",
    "FROTO.E",
    "KCHOL.E",
    "SAHOL.E",
    "SISE.E",
    "EREGL.E",
    "TCELL.E",
    "TAVHL.E",
    "MGROS.E",
    "TOASO.E",
    "ULKER.E",
)
EXTERNAL_TPP = "CASH_TPP"
INTERNAL_TPP = "TPP_ON"
EXTERNAL_ASSETS = EQUITIES + (EXTERNAL_TPP,)
INTERNAL_ASSETS = EQUITIES + (INTERNAL_TPP,)


class RlInferenceError(ValueError):
    """A deterministic request or packaged-artifact contract failure."""


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _money(value: float) -> float:
    return round(float(value), 2)


def _percentage(decimal_return: float) -> float:
    return round(float(decimal_return) * 100.0, 6)


def _weight(value: float) -> float:
    return round(float(value), 12)


@dataclass
class LoadedPolicy:
    public_name: str
    seed: int
    config: dict[str, Any]
    model: PPO
    market: V22MarketData
    paths: dict[str, ScenarioPathV22]
    lock: threading.Lock


class RlInferenceEngine:
    def __init__(
        self,
        *,
        root: Path,
        registry: dict[str, Any],
        policies: dict[str, LoadedPolicy],
    ) -> None:
        self.root = root
        self.registry = registry
        self.policies = policies

    @classmethod
    def load(cls, root: str | Path) -> "RlInferenceEngine":
        root_path = Path(root).resolve()
        registry_path = root_path / "configs" / "rl_model_registry.json"
        if not registry_path.is_file():
            raise RuntimeError(f"Missing RL registry: {registry_path}")
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        data_paths = cls._validate_data_files(root_path, registry)

        policies: dict[str, LoadedPolicy] = {}
        shared_market: V22MarketData | None = None
        shared_market_contract: tuple[Any, ...] | None = None
        for public_name, spec in registry["models"].items():
            model_path = root_path / spec["model_file"]
            config_path = root_path / spec["config_file"]
            cls._require_hash(model_path, spec["model_sha256"], f"model {public_name}")
            cls._require_hash(config_path, spec["config_sha256"], f"config {public_name}")

            config = load_config(config_path)
            cls._bind_packaged_data(config, data_paths)
            config["ppo"]["device"] = "cpu"
            contract = (
                tuple(config["universe"]["tickers"]),
                config["universe"]["tpp_symbol"],
                int(config["data"]["lookback_sessions"]),
                str(config["data"]["events"]["S1"]["active_start"]),
                str(config["data"]["events"]["S1"]["active_end"]),
                str(config["data"]["events"]["S2"]["active_start"]),
                str(config["data"]["events"]["S2"]["active_end"]),
            )
            if shared_market is None:
                shared_market = V22MarketData.from_config(config)
                shared_market_contract = contract
            elif contract != shared_market_contract:
                raise RuntimeError(f"RL market contract mismatch for {public_name}")

            scenarios = ScenarioLibraryV22(config, shared_market)
            runtime = RuntimeV22(config=config, market=shared_market, scenarios=scenarios)
            paths = {
                family: build_historical_path(runtime, family)
                for family in ("S1", "S2")
            }
            # The checkpoints were serialized under Python 3.12 with closure-based
            # training schedules. Inference does not use those schedules; replacing
            # them avoids cross-minor-version cloudpickle closure corruption while
            # leaving every policy/value-network weight untouched.
            model = PPO.load(
                model_path,
                device="cpu",
                custom_objects={"learning_rate": 0.0, "clip_range": 0.2},
            )
            expected_observation = (int(spec["state_dimension"]),)
            expected_action = (int(spec["action_dimension"]),)
            if model.observation_space.shape != expected_observation:
                raise RuntimeError(
                    f"{public_name} observation space {model.observation_space.shape} "
                    f"!= {expected_observation}"
                )
            if model.action_space.shape != expected_action:
                raise RuntimeError(
                    f"{public_name} action space {model.action_space.shape} != {expected_action}"
                )
            policies[public_name] = LoadedPolicy(
                public_name=public_name,
                seed=int(spec["seed"]),
                config=config,
                model=model,
                market=shared_market,
                paths=paths,
                lock=threading.Lock(),
            )
        return cls(root=root_path, registry=registry, policies=policies)

    @staticmethod
    def _validate_data_files(root: Path, registry: dict[str, Any]) -> dict[str, Path]:
        data_root = root / registry["data_root"]
        data_paths: dict[str, Path] = {}
        for key, spec in registry["data_files"].items():
            path = data_root / spec["file"]
            RlInferenceEngine._require_hash(path, spec["sha256"], f"data {key}")
            data_paths[key] = path
        return data_paths

    @staticmethod
    def _require_hash(path: Path, expected: str, label: str) -> None:
        if not path.is_file():
            raise RuntimeError(f"Missing packaged RL {label}: {path}")
        actual = _sha256(path)
        if actual.lower() != str(expected).lower():
            raise RuntimeError(
                f"Packaged RL {label} hash mismatch: expected {expected}, observed {actual}"
            )

    @staticmethod
    def _bind_packaged_data(config: dict[str, Any], paths: dict[str, Path]) -> None:
        for key, path in paths.items():
            config["paths"][key] = str(path)

    @property
    def model_names(self) -> tuple[str, ...]:
        return tuple(self.policies)

    @property
    def scenario_names(self) -> tuple[str, ...]:
        return tuple(self.registry["scenarios"])

    def infer(
        self,
        *,
        model_name: str,
        scenario_name: str,
        initial_nav: float,
        initial_weights: dict[str, float],
    ) -> dict[str, Any]:
        if model_name not in self.policies:
            raise RlInferenceError(f"Unknown RL model: {model_name}")
        scenario_spec = self.registry["scenarios"].get(scenario_name)
        if scenario_spec is None:
            raise RlInferenceError(f"Unknown RL scenario: {scenario_name}")
        if not np.isfinite(initial_nav) or float(initial_nav) <= 0.0:
            raise RlInferenceError("initial_nav must be positive and finite")

        policy = self.policies[model_name]
        internal_weights = self._canonical_initial_weights(initial_weights, policy.config)
        config = deepcopy(policy.config)
        config["project"]["initial_nav_try"] = float(initial_nav)
        config["universe"]["initial_weights"] = internal_weights
        family = str(scenario_spec["family"])
        path = policy.paths[family]
        env = BistStressEnvV22(
            config,
            ScenarioLibraryV22(config, policy.market),
            split="test",
        )
        try:
            with policy.lock:
                metrics, daily = run_episode(policy.model, env, path, policy.seed)
        finally:
            env.close()

        expected_days = int(scenario_spec["expected_trading_days"])
        if len(daily) != expected_days:
            raise RuntimeError(
                f"Scenario {scenario_name} returned {len(daily)} days, expected {expected_days}"
            )
        constraints = ProspectusConstraints(config["constraints"], len(EQUITIES))
        days: list[dict[str, Any]] = []
        for row in daily.to_dict(orient="records"):
            internal_day_weights = [float(row[f"weight_{asset}"]) for asset in INTERNAL_ASSETS]
            result = constraints.validate(internal_day_weights)
            if not result.ok:
                raise RuntimeError(
                    f"Packaged policy produced an illegal portfolio on {row['execution_date']}: "
                    f"{', '.join(result.violations)}"
                )
            weights = {
                external: _weight(internal_day_weights[index])
                for index, external in enumerate(EXTERNAL_ASSETS)
            }
            days.append(
                {
                    "day_number": int(row["scenario_day"]),
                    "date": str(row["execution_date"]),
                    "total_new_nav": _money(row["nav"]),
                    "passive_nav": _money(row["passive_nav"]),
                    "weights": weights,
                }
            )

        final_nav = float(metrics["terminal_nav_try"])
        passive_final_nav = float(metrics["passive_terminal_nav_try"])
        initial_nav_value = float(initial_nav)
        return {
            "model": model_name,
            "scenario": scenario_name,
            "scenario_start_date": str(scenario_spec["start_date"]),
            "scenario_end_date": str(scenario_spec["end_date"]),
            "trading_day_count": expected_days,
            "initial_nav": _money(initial_nav_value),
            "days": days,
            "final_nav": _money(final_nav),
            "return_pct": _percentage(final_nav / initial_nav_value - 1.0),
            "passive_final_nav": _money(passive_final_nav),
            "passive_return_pct": _percentage(passive_final_nav / initial_nav_value - 1.0),
            "outperformance_amount": _money(final_nav - passive_final_nav),
            "outperformance_pct": _percentage(
                (final_nav - passive_final_nav) / initial_nav_value
            ),
            "total_commission": _money(metrics["total_commission_try"]),
        }

    @staticmethod
    def _canonical_initial_weights(
        payload: dict[str, float], config: dict[str, Any]
    ) -> dict[str, float]:
        received = set(payload)
        expected = set(EXTERNAL_ASSETS)
        if received != expected:
            missing = sorted(expected - received)
            unknown = sorted(received - expected)
            raise RlInferenceError(
                f"initial_weights asset set mismatch; missing={missing}, unknown={unknown}"
            )
        values = np.asarray([payload[asset] for asset in EXTERNAL_ASSETS], dtype=np.float64)
        if not np.isfinite(values).all() or np.any(values < 0.0):
            raise RlInferenceError("initial_weights must contain finite non-negative values")
        try:
            ProspectusConstraints(config["constraints"], len(EQUITIES)).require(values)
        except ValueError as exc:
            raise RlInferenceError(str(exc)) from exc
        return {
            internal: float(values[index])
            for index, internal in enumerate(INTERNAL_ASSETS)
        }
