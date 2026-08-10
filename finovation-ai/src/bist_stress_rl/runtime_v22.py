from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .config import load_config
from .data_v22 import V22MarketData, data_contract
from .scenarios_v22 import ScenarioLibraryV22
from .state_v22 import StateBuilderV22


@dataclass(frozen=True)
class RuntimeV22:
    config: dict
    market: V22MarketData
    scenarios: ScenarioLibraryV22


def build_runtime_v22(config_path: str, *, write_contracts: bool = True) -> RuntimeV22:
    config = load_config(config_path)
    if not str(config["config_version"]).startswith("2.2"):
        raise ValueError("build_runtime_v22 requires a V2.2 config")
    market = V22MarketData.from_config(config)
    scenarios = ScenarioLibraryV22(config, market)
    runtime = RuntimeV22(config=config, market=market, scenarios=scenarios)
    if write_contracts:
        root = Path(config["paths"]["artifacts_dir"])
        root.mkdir(parents=True, exist_ok=True)
        (root / "data_contract_v22.json").write_text(
            json.dumps(data_contract(config, market), indent=2, ensure_ascii=False), encoding="utf-8"
        )
        builder = StateBuilderV22(config)
        model_contract_dir = root / str(config["model"]["id"]).lower()
        model_contract_dir.mkdir(parents=True, exist_ok=True)
        (model_contract_dir / "feature_contract.json").write_text(
            json.dumps(builder.contract(), indent=2, ensure_ascii=False), encoding="utf-8"
        )
        action_contract = {
            "version": config["action"]["version"],
            "dimension": config["action"]["raw_dimension"],
            "space": config["action"]["space"],
            "layout": config["action"]["layout"],
            "continuous_fractional_weights": True,
            "prospectus_is_hard_constraint": True,
        }
        (model_contract_dir / "action_contract.json").write_text(
            json.dumps(action_contract, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        (model_contract_dir / "reward_contract.json").write_text(
            json.dumps(config["reward"], indent=2, ensure_ascii=False), encoding="utf-8"
        )
    return runtime
