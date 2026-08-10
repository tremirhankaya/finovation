from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml


def load_config(path: str | Path) -> dict[str, Any]:
    path = Path(path).resolve()
    config = _read_config_tree(path, seen=set())
    if not isinstance(config, dict):
        raise ValueError("Config root must be a mapping")
    config = deepcopy(config)
    _normalize_versioned_contracts(config)
    config["_config_path"] = str(path)
    config["_project_root"] = str(path.parent)
    _resolve_paths(config, path.parent)
    _validate_config(config)
    return config


def _normalize_versioned_contracts(config: dict[str, Any]) -> None:
    action = config.get("action", {})
    if str(action.get("version")) == "action_v22d_absolute":
        action["layout"] = {
            "tpp_absolute": 0,
            "heavy_count_preference": 1,
            "equity_tilts": [2, 17],
        }


def _read_config_tree(path: Path, *, seen: set[Path]) -> dict[str, Any]:
    if path in seen:
        raise ValueError(f"Cyclic config inheritance: {path}")
    seen = {*seen, path}
    with path.open("r", encoding="utf-8") as handle:
        current = yaml.safe_load(handle)
    if not isinstance(current, dict):
        raise ValueError("Config root must be a mapping")
    parent_value = current.pop("extends", None)
    if parent_value is None:
        return current
    parent_path = Path(parent_value)
    if not parent_path.is_absolute():
        parent_path = (path.parent / parent_path).resolve()
    parent = _read_config_tree(parent_path, seen=seen)
    return _deep_merge(parent, current)


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result


def _resolve_paths(config: dict[str, Any], root: Path) -> None:
    for key, value in config.get("paths", {}).items():
        candidate = Path(value)
        config["paths"][key] = str(candidate if candidate.is_absolute() else (root / candidate).resolve())


def _validate_config(config: dict[str, Any]) -> None:
    tickers = list(config["universe"]["tickers"])
    if len(tickers) != 16 or len(set(tickers)) != 16:
        raise ValueError("V2 requires exactly 16 unique equities")
    weights = config["universe"]["initial_weights"]
    expected = set(tickers) | {config["universe"]["tpp_symbol"]}
    if set(weights) != expected:
        raise ValueError("Initial weight keys do not match the fixed universe")
    if abs(sum(float(value) for value in weights.values()) - 1.0) > 1e-10:
        raise ValueError("Initial weights must sum to one")
    observation_version = str(config["observation"]["version"])
    expected_dimensions = {
        "state_v2": len(tickers) * 6 + 16,
        "state_v3": len(tickers) * 7 + 19,
        "state_v4_blind": len(tickers) * 12 + 41,
        "state_v4_scenario": len(tickers) * 12 + 53,
        "state_v4_oracle": len(tickers) * 14 + 53,
        "state_v22d_dynamic": len(tickers) * 15 + 53,
    }
    if observation_version not in expected_dimensions:
        raise ValueError(f"Unknown observation version: {observation_version}")
    if int(config["observation"]["dimension"]) != expected_dimensions[observation_version]:
        raise ValueError(
            f"{observation_version} must contain {expected_dimensions[observation_version]} features"
        )
    action_version = str(config["action"].get("version", "action_v1"))
    expected_action_dimension = len(tickers) + (
        2 if action_version in {"action_v22_delta", "action_v22d_absolute"} else 4
    )
    if int(config["action"]["raw_dimension"]) != expected_action_dimension:
        raise ValueError(
            f"{action_version} must contain {expected_action_dimension} continuous values"
        )
    if int(config["ppo"]["n_steps"]) * int(config["ppo"]["n_envs"]) % int(config["ppo"]["batch_size"]):
        raise ValueError("PPO rollout size must be divisible by batch size")
    family_probability = sum(float(value) for value in config["scenario_generator"]["families"].values())
    if abs(family_probability - 1.0) > 1e-10:
        raise ValueError("Scenario-family probabilities must sum to one")


def project_root(config: dict[str, Any]) -> Path:
    return Path(config["_project_root"])
