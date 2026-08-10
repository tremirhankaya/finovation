from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

from .scenarios import ScenarioPath


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _update_array(digest: "hashlib._Hash", value: np.ndarray) -> None:
    array = np.ascontiguousarray(value)
    digest.update(str(array.dtype).encode("ascii"))
    digest.update(json.dumps(array.shape).encode("ascii"))
    digest.update(array.tobytes(order="C"))


def hash_scenario_path(path: ScenarioPath) -> str:
    digest = hashlib.sha256()
    digest.update(str(path.family).encode("utf-8"))
    digest.update(str(path.scenario_seed).encode("ascii"))
    digest.update(json.dumps(path.dates, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    digest.update(json.dumps(path.segments, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    digest.update(str(path.lookback).encode("ascii"))
    for array in (
        path.prices,
        path.fx_levels,
        path.tpp_annual_rates,
        path.calendar_accrual_days,
    ):
        _update_array(digest, np.asarray(array))
    return digest.hexdigest()


def hash_daily_trace(frame: pd.DataFrame, symbols: Iterable[str]) -> str:
    digest = hashlib.sha256()
    ordered = frame.sort_values("scenario_day", kind="stable")
    symbols = list(symbols)
    digest.update("|".join(ordered["action_status"].astype(str)).encode("utf-8"))
    numeric_columns = [
        "scenario_day",
        "nav_before_trade",
        "nav",
        "passive_nav",
        "turnover",
        "commission",
        *[f"weight_{symbol}" for symbol in symbols],
        *[f"trade_try_{symbol}" for symbol in symbols],
    ]
    _update_array(digest, ordered[numeric_columns].to_numpy(dtype=np.float64))
    actions = np.stack([np.asarray(value, dtype=np.float64) for value in ordered["raw_action"]])
    _update_array(digest, actions)
    return digest.hexdigest()


def write_hash_manifest(
    output_path: str | Path,
    *,
    files: Iterable[str | Path],
    paths: Iterable[ScenarioPath],
    metadata: dict | None = None,
) -> Path:
    output = Path(output_path)
    file_rows = []
    for value in files:
        path = Path(value).resolve()
        file_rows.append(
            {
                "path": str(path),
                "bytes": int(path.stat().st_size),
                "sha256": sha256_file(path),
            }
        )
    path_rows = [
        {
            "path_id": f"{path.family}_{int(path.scenario_seed):06d}",
            "family": path.family,
            "scenario_seed": int(path.scenario_seed),
            "sha256": hash_scenario_path(path),
        }
        for path in paths
    ]
    payload = {
        "schema_version": "bist_stress_rl_evidence_v1",
        "metadata": metadata or {},
        "files": file_rows,
        "scenario_paths": path_rows,
    }
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return output
