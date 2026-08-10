from __future__ import annotations

from dataclasses import dataclass

from .config import load_config
from .data import HistoricalMarket, write_data_manifest
from .scenarios import ScenarioLibrary


@dataclass(frozen=True)
class Runtime:
    config: dict
    market: HistoricalMarket
    scenarios: ScenarioLibrary


def build_runtime(config_path: str = "config.yaml", *, write_manifest: bool = True) -> Runtime:
    config = load_config(config_path)
    market = HistoricalMarket.from_config(config)
    scenarios = ScenarioLibrary(config, market)
    if write_manifest:
        write_data_manifest(config, market)
    return Runtime(config=config, market=market, scenarios=scenarios)
