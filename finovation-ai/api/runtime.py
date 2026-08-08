from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from fund_ml.portfolio import PortfolioEngine

from api.settings import (
    EXPECTED_FORECAST_SCHEMA,
    EXPECTED_POLICY_CONFIG,
    ServiceSettings,
)


REQUIRED_RUNTIME_FILES = (
    "configs/project.json",
    "configs/objectives.json",
    "artifacts/forecast_bundle_v3/manifest.json",
    "artifacts/forecast_bundle_v3/equity_forecasts.parquet",
    "artifacts/risk/manifest.json",
    "artifacts/risk/universe58_beta.parquet",
    "artifacts/risk/covariance.parquet",
    "artifacts/tpp/manifest.json",
    "artifacts/tpp/tpp_scenarios.parquet",
    "data/source/instrument_master.parquet",
)


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def snapshot_id(system_date: str, schema_version: str) -> str:
    suffix = "V3" if schema_version == EXPECTED_FORECAST_SCHEMA else schema_version
    return f"FROZEN_{system_date}_{suffix}"


@dataclass
class RuntimeState:
    settings: ServiceSettings
    engine: PortfolioEngine | None = None
    ready: bool = False
    startup_error: str | None = None
    loaded_at_utc: str | None = None
    load_count: int = 0
    _snapshot_id: str | None = field(default=None, init=False, repr=False)

    def initialize(self) -> None:
        if self.load_count > 0:
            return
        self.load_count += 1
        try:
            self.engine = self._load_and_validate()
            bundles = self.engine.bundles
            self._snapshot_id = snapshot_id(
                bundles.project["system_date"],
                bundles.forecast_manifest["schema_version"],
            )
            self.loaded_at_utc = datetime.now(timezone.utc).isoformat()
            self.ready = True
            self.startup_error = None
        except Exception as exc:  # readiness reports sanitized startup failure
            self.engine = None
            self.ready = False
            self.startup_error = f"{type(exc).__name__}: {exc}"

    def _load_and_validate(self) -> PortfolioEngine:
        root = self.settings.root
        missing = [rel for rel in REQUIRED_RUNTIME_FILES if not (root / rel).is_file()]
        if missing:
            raise RuntimeError(f"Missing runtime files: {missing}")

        engine = PortfolioEngine.load(root)
        bundles = engine.bundles
        if bundles.forecast_manifest["schema_version"] != EXPECTED_FORECAST_SCHEMA:
            raise RuntimeError("Frozen API V1 requires EQUITY_FORECAST_BUNDLE_V3")
        if (
            bundles.forecast_manifest["forecast_origin"]
            != bundles.project["forecast_origin"]
        ):
            raise RuntimeError("Forecast/project origin mismatch")
        if bundles.objectives["config_id"] != EXPECTED_POLICY_CONFIG:
            raise RuntimeError("Unexpected policy config")

        risk_manifest = _read_json(root / "artifacts" / "risk" / "manifest.json")
        tpp_manifest = _read_json(root / "artifacts" / "tpp" / "manifest.json")
        if int(risk_manifest["asset_count"]) != 58:
            raise RuntimeError("Risk manifest asset count mismatch")
        if bool(risk_manifest.get("post_cutoff_data_used")):
            raise RuntimeError("Risk artifact reports post-cutoff data use")
        if risk_manifest["available_by"] > bundles.project["system_date"]:
            raise RuntimeError("Risk artifact is not available by system date")
        if tpp_manifest["information_cutoff"] > bundles.project["system_date"]:
            raise RuntimeError("TPP artifact uses post-system-date information")
        return engine

    @property
    def snapshot_id(self) -> str | None:
        return self._snapshot_id

    @property
    def bundles(self):
        return self.engine.bundles if self.engine is not None else None

    def public_status(self) -> dict:
        return {
            "ready": self.ready,
            "snapshot_id": self.snapshot_id,
            "loaded_at_utc": self.loaded_at_utc,
            "load_count": self.load_count,
        }
