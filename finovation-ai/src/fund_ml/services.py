from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class EngineBundles:
    root: Path
    project: dict
    objectives: dict
    forecast_manifest: dict
    forecasts: pd.DataFrame
    tpp: pd.DataFrame
    beta: pd.Series
    covariance_daily: pd.DataFrame
    sectors: pd.Series

    @classmethod
    def load(cls, root: Path) -> "EngineBundles":
        root = root.resolve()
        project = json.loads((root / "configs" / "project.json").read_text(encoding="utf-8"))
        objectives = json.loads(
            (root / "configs" / "objectives.json").read_text(encoding="utf-8")
        )
        v3_dir = root / "artifacts" / "forecast_bundle_v3"
        forecast_dir = v3_dir if (v3_dir / "manifest.json").exists() else root / "artifacts" / "forecast_bundle_v2"
        forecast_manifest = json.loads(
            (forecast_dir / "manifest.json").read_text(encoding="utf-8")
        )
        forecasts = pd.read_parquet(forecast_dir / "equity_forecasts.parquet")
        tpp = pd.read_parquet(root / "artifacts" / "tpp" / "tpp_scenarios.parquet")
        beta_frame = pd.read_parquet(root / "artifacts" / "risk" / "universe58_beta.parquet")
        covariance = pd.read_parquet(root / "artifacts" / "risk" / "covariance.parquet")
        master = pd.read_parquet(root / "data" / "source" / "instrument_master.parquet")
        master = master.loc[
            master["instrument_type"].eq("EQUITY")
            & master["role"].eq("CORE_EQUITY_PRICE_RETURN")
        ].copy()
        if len(master) != 58 or master["instrument_id"].nunique() != 58:
            raise RuntimeError("Instrument master does not contain exact core 58")
        sectors = master.set_index("instrument_id")["sector_code"].sort_index()
        beta = beta_frame.set_index("instrument_id")["universe58_beta"].sort_index()
        covariance_daily = covariance.pivot(
            index="instrument_id_i", columns="instrument_id_j", values="covariance_daily"
        ).sort_index().sort_index(axis=1)
        bundle = cls(
            root,
            project,
            objectives,
            forecast_manifest,
            forecasts,
            tpp,
            beta,
            covariance_daily,
            sectors,
        )
        bundle.validate()
        return bundle

    @property
    def universe(self) -> list[str]:
        return sorted(self.sectors.index.tolist())

    def validate(self) -> None:
        if self.forecast_manifest["schema_version"] not in {
            "EQUITY_FORECAST_BUNDLE_V2",
            "EQUITY_FORECAST_BUNDLE_V3",
        }:
            raise RuntimeError("Wrong forecast bundle schema")
        if self.forecast_manifest["system_date"] != self.project["system_date"]:
            raise RuntimeError("Forecast/project system-date mismatch")
        if len(self.forecasts) != 174:
            raise RuntimeError("Forecast bundle must have 174 rows")
        for horizon, part in self.forecasts.groupby("horizon_months"):
            if len(part) != 58 or part["instrument_id"].nunique() != 58:
                raise RuntimeError(f"Forecast horizon {horizon} is not exact 58")
            if ((part["q10"] > part["q50"]) | (part["q50"] > part["q90"])).any():
                raise RuntimeError(f"Raw quantile crossing at {horizon}M")
            if (
                self.forecast_manifest["schema_version"] == "EQUITY_FORECAST_BUNDLE_V3"
                and part["q50"].nunique() < 10
            ):
                raise RuntimeError(f"Hard q50 differentiation gate failed at {horizon}M")
        if set(self.universe) != set(self.beta.index):
            raise RuntimeError("Beta universe mismatch")
        if self.covariance_daily.shape != (58, 58):
            raise RuntimeError("Covariance shape mismatch")
        if set(self.universe) != set(self.covariance_daily.index):
            raise RuntimeError("Covariance universe mismatch")
        if set(self.tpp["horizon_months"].astype(int)) != {3, 6, 12}:
            raise RuntimeError("TPP horizon mismatch")

    def horizon_forecasts(self, horizon: int) -> pd.DataFrame:
        frame = self.forecasts.loc[self.forecasts["horizon_months"].eq(horizon)].copy()
        if frame.empty or not frame["model_horizon_eligible"].astype(bool).all():
            raise RuntimeError(f"MODEL_HORIZON_NOT_ELIGIBLE:{horizon}M")
        return frame.sort_values("instrument_id").reset_index(drop=True)

    def equity_signals(self, horizon: int, objective_id: str) -> pd.DataFrame:
        definition = self.objectives["definitions"][objective_id]
        frame = self.horizon_forecasts(horizon)
        downside_gap = frame["q50"] - frame["q10"]
        interval = frame["q90"] - frame["q10"]
        rank_centered = frame["rank_percentile"].fillna(0.5) - 0.5
        frame["selection_utility"] = (
            frame["q50"]
            - float(definition["downside_penalty"]) * downside_gap
            - float(definition["uncertainty_penalty"]) * interval
            + float(definition["rank_weight"]) * rank_centered
        )
        frame["universe58_beta"] = frame["instrument_id"].map(self.beta)
        frame["sector_code"] = frame["instrument_id"].map(self.sectors)
        if frame[["selection_utility", "universe58_beta", "sector_code"]].isna().any().any():
            raise RuntimeError("Incomplete signal/risk/sector join")
        return frame

    def tpp_log_carry(self, horizon: int) -> float:
        row = self.tpp.loc[self.tpp["horizon_months"].eq(horizon)]
        if len(row) != 1:
            raise RuntimeError("TPP scenario identity mismatch")
        return float(np.log1p(float(row.iloc[0]["scenario_median_return"])))

    def covariance_for(self, instruments: list[str], horizon: int) -> np.ndarray:
        sessions = int(self.objectives["horizon_trading_sessions"][str(horizon)])
        return (
            self.covariance_daily.loc[instruments, instruments].to_numpy(dtype=float)
            * sessions
        )
