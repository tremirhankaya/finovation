from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .evidence import sha256_file
from .runtime import build_runtime


def _hash_strings(values: list[str]) -> str:
    digest = hashlib.sha256()
    for value in values:
        encoded = value.encode("utf-8")
        digest.update(len(encoded).to_bytes(4, "little"))
        digest.update(encoded)
    return digest.hexdigest()


def _feature_contract(config: dict[str, Any]) -> dict[str, Any]:
    tickers = list(config["universe"]["tickers"])
    version = str(config["observation"]["version"])
    per_equity = [
        ("r1", 0.05),
        ("r5", 0.10),
        ("r20", 0.25),
        ("vol20", 0.05),
        ("dd20", 0.25),
        ("agent_weight", 0.10),
    ]
    if version == "state_v3":
        per_equity.append(("passive_weight", 0.10))
    fields = [
        {
            "index": index,
            "name": f"{ticker}.{feature}",
            "known_at": "decision close t-1",
            "scale": scale,
        }
        for index, (ticker, (feature, scale)) in enumerate(
            (ticker, pair) for ticker in tickers for pair in per_equity
        )
    ]
    globals_ = [
        ("market_r1", 0.05),
        ("market_r5", 0.10),
        ("market_r20", 0.25),
        ("market_vol20", 0.05),
        ("market_dd20", 0.25),
        ("usdtry_r1", 0.03),
        ("usdtry_r5", 0.06),
        ("usdtry_vol20", 0.02),
        ("known_tpp_annual_rate", 50.0),
        ("agent_tpp_weight", 0.15),
    ]
    if version == "state_v3":
        globals_.append(("passive_tpp_weight", 0.15))
    globals_.append(("agent_log_nav_from_initial", 0.25))
    if version == "state_v3":
        globals_.append(("agent_log_nav_relative_to_passive", 0.10))
    globals_.append(("agent_drawdown", 0.25))
    if version == "state_v3":
        globals_.append(("passive_drawdown", 0.25))
    globals_.extend(
        [
            ("previous_turnover", 0.10),
            ("previous_commission_fraction", 0.001),
            ("known_calendar_accrual_days", 4.0),
            ("remaining_horizon_fraction", 1.0),
        ]
    )
    offset = len(fields)
    fields.extend(
        {
            "index": offset + index,
            "name": name,
            "known_at": "decision close t-1",
            "scale": scale,
        }
        for index, (name, scale) in enumerate(globals_)
    )
    if len(fields) != int(config["observation"]["dimension"]):
        raise RuntimeError("Feature contract dimension does not match config")
    return {
        "schema_version": "feature_contract_v1",
        "observation_version": version,
        "dimension": len(fields),
        "clip": float(config["observation"]["clip"]),
        "order": fields,
    }


def _action_contract(config: dict[str, Any]) -> dict[str, Any]:
    action = config["action"]
    constraints = config["constraints"]
    return {
        "schema_version": "action_decoder_contract_v1",
        "space": action["space"],
        "dimension": int(action["raw_dimension"]),
        "layout": action["layout"],
        "hold_gate": "gate <= 0 and current portfolio legal",
        "forced_gate": "current portfolio illegal bypasses hold gate",
        "minimum_one_way_turnover": float(action["minimum_one_way_turnover_to_execute"]),
        "projection_used": bool(action["projection_to_nearest_portfolio"]),
        "operational_bounds": constraints["operational"],
        "strict_validator": {
            key: constraints[key]
            for key in (
                "equity_sum_min",
                "equity_sum_max",
                "tpp_min",
                "tpp_max",
                "stock_weight_min",
                "stock_weight_max",
                "heavy_threshold_strict",
                "heavy_sum_strict_max",
                "active_equity_count",
            )
        },
    }


def _reward_accounting_contract(config: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": "reward_accounting_contract_v1",
        "reward": config["reward"],
        "formula": (
            "scale_alpha*(log(W_t_pre/W_t-1_post)-log(B_t/B_t-1)) "
            "+ scale_cost*log(W_t_post/W_t_pre) - lambda_mdd*delta_running_mdd "
            "- lambda_turnover*max(0,turnover-hinge)"
        ),
        "accounting": config["accounting"],
        "declared_execution": config["project"]["execution"],
        "observed_forced_compliance_exception": (
            "Current V2 checks compliance after t close move and executes repair at the same t close; "
            "this is a known P0 failure and requires V2.1 plus a new lock."
        ),
        "terminal_contract": (
            "valuation-only when current portfolio remains legal; current V2 may force a final-day "
            "repair when the t close drift is illegal"
        ),
    }


def _data_quality_audit(config: dict[str, Any], runtime) -> dict[str, Any]:
    tickers = list(config["universe"]["tickers"])
    prices = pd.read_parquet(config["paths"]["equity_prices"])
    prices = prices[prices["instrument_id"].isin(tickers)].copy()
    eligible_source = prices["source_quality_eligible"].fillna(False).astype(bool)
    prices["date"] = pd.to_datetime(prices["date"], errors="coerce")
    prices["available_from"] = pd.to_datetime(prices["available_from"], errors="coerce")
    in_model_scope = prices["date"].between(
        pd.Timestamp(config["data"]["ignore_before"]),
        pd.Timestamp(config["data"]["relocked_test_end"]),
        inclusive="both",
    )
    fx = pd.read_parquet(config["paths"]["fx_daily"]).copy()
    fx["date"] = pd.to_datetime(fx["date"], errors="coerce")
    fx["available_from"] = pd.to_datetime(fx["available_from"], errors="coerce")
    split_ranges = {
        "train": (pd.Timestamp(config["data"]["train_start"]), pd.Timestamp(config["data"]["train_end"])),
        "validation": (
            pd.Timestamp(config["data"]["validation_start"]),
            pd.Timestamp(config["data"]["validation_end"]),
        ),
        "test": (
            pd.Timestamp(config["data"]["relocked_test_start"]),
            pd.Timestamp(config["data"]["relocked_test_end"]),
        ),
    }
    late_boundary: dict[str, int] = {}
    for name, (start, end) in split_ranges.items():
        in_split = prices["date"].between(start, end, inclusive="both")
        late_boundary[name] = int((in_split & (prices["available_from"] > end)).sum())
    masks = {
        "train": runtime.market.train_mask,
        "validation": runtime.market.validation_mask,
        "test": runtime.market.test_mask,
    }
    overlap = {
        "train_validation": int(np.count_nonzero(masks["train"] & masks["validation"])),
        "train_test": int(np.count_nonzero(masks["train"] & masks["test"])),
        "validation_test": int(np.count_nonzero(masks["validation"] & masks["test"])),
    }
    return {
        "schema_version": "data_quality_audit_v1",
        "fixed_universe_rows": int(len(prices)),
        "duplicate_instrument_date_rows": int(prices.duplicated(["instrument_id", "date"]).sum()),
        "raw_missing_available_from_rows": int(prices["available_from"].isna().sum()),
        "eligible_source_missing_available_from_rows_all_dates": int(
            (eligible_source & prices["available_from"].isna()).sum()
        ),
        "eligible_source_missing_available_from_rows": int(
            (eligible_source & in_model_scope & prices["available_from"].isna()).sum()
        ),
        "available_from_before_source_date_rows": int((prices["available_from"] < prices["date"]).sum()),
        "available_from_after_source_date_rows": int((prices["available_from"] > prices["date"]).sum()),
        "split_boundary_rows_available_after_split_end": late_boundary,
        "fx_missing_available_from_rows": int(fx["available_from"].isna().sum()),
        "fx_available_from_before_source_date_rows": int((fx["available_from"] < fx["date"]).sum()),
        "eligible_returns": {name: int(mask.sum()) for name, mask in masks.items()},
        "split_mask_overlap": overlap,
        "masked_return_rows": int((~runtime.market.eligible_return_mask).sum()),
        "residual_sampling_contract": "sample_joint_residuals selects only contiguous train_mask blocks",
        "future_fill_contract": "FX uses backward merge_asof; no bfill",
        "assessment": "PASS" if not any(overlap.values()) and not any(late_boundary.values()) else "WARN",
    }


def build_contract_package(config_path: str, output_dir: str | Path | None = None) -> Path:
    runtime = build_runtime(config_path)
    config = runtime.config
    output = Path(output_dir or (Path(config["paths"]["artifacts_dir"]) / "contracts_v2"))
    output.mkdir(parents=True, exist_ok=True)

    feature = _feature_contract(config)
    action = _action_contract(config)
    reward = _reward_accounting_contract(config)
    quality = _data_quality_audit(config, runtime)
    payloads = {
        "feature_contract_v2.json": feature,
        "action_decoder_contract_v2.json": action,
        "reward_accounting_contract_v2.json": reward,
        "data_quality_audit_v2.json": quality,
    }
    for name, payload in payloads.items():
        (output / name).write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    dates = pd.to_datetime(runtime.market.dates)
    panel = pd.DataFrame({"date": dates, "fx_usdtry_known": runtime.market.fx_levels})
    for index, ticker in enumerate(config["universe"]["tickers"]):
        panel[f"close_{ticker}"] = runtime.market.closes[:, index]
    panel["market_return"] = np.r_[np.nan, runtime.market.market_returns]
    panel["eligible_return"] = np.r_[False, runtime.market.eligible_return_mask]
    panel["split"] = "OUTSIDE"
    for name, mask in (
        ("TRAIN", runtime.market.train_mask),
        ("VALIDATION", runtime.market.validation_mask),
        ("RELOCKED_TEST", runtime.market.test_mask),
    ):
        expanded = np.r_[False, mask]
        panel.loc[expanded, "split"] = name
    panel.to_parquet(output / "canonical_panel_v2.parquet", index=False)

    return_dates = [str(value)[:10] for value in runtime.market.dates[1:]]
    split_manifest = {
        "schema_version": "split_manifest_v1",
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "train": {
            "dates_sha256": _hash_strings([date for date, flag in zip(return_dates, runtime.market.train_mask) if flag]),
            "count": int(runtime.market.train_mask.sum()),
        },
        "validation": {
            "dates_sha256": _hash_strings(
                [date for date, flag in zip(return_dates, runtime.market.validation_mask) if flag]
            ),
            "count": int(runtime.market.validation_mask.sum()),
        },
        "relocked_test": {
            "dates_sha256": _hash_strings([date for date, flag in zip(return_dates, runtime.market.test_mask) if flag]),
            "count": int(runtime.market.test_mask.sum()),
        },
        "overlap": quality["split_mask_overlap"],
        "test_generator_access": "synthetic test paths use train-only warmup/residual/TPP pools and fixed test RNG seeds",
    }
    (output / "split_manifest_v2.json").write_text(
        json.dumps(split_manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    files = [path for path in output.iterdir() if path.is_file() and path.name != "contract_index.json"]
    index = {
        "schema_version": "contract_package_index_v1",
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "config": str(Path(config_path).resolve()),
        "config_sha256": sha256_file(config_path),
        "files": {
            path.name: {"bytes": int(path.stat().st_size), "sha256": sha256_file(path)}
            for path in sorted(files)
        },
    }
    (output / "contract_index.json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"CONTRACT_PACKAGE_COMPLETE {output}", flush=True)
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--output-dir")
    args = parser.parse_args()
    build_contract_package(args.config, args.output_dir)


if __name__ == "__main__":
    main()
