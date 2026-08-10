from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .config import load_config


def _fingerprint(path: str | Path) -> dict[str, str | int]:
    path = Path(path)
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": digest.hexdigest()}


def _quality_has_rejected_flag(value: object) -> bool:
    text = str(value).upper()
    return "ABS_DAILY_RETURN_GT_30PCT" in text


@dataclass
class HistoricalMarket:
    tickers: list[str]
    dates: np.ndarray
    closes: np.ndarray
    returns: np.ndarray
    fx_levels: np.ndarray
    fx_returns: np.ndarray
    market_returns: np.ndarray
    model_coefficients: np.ndarray
    residuals: np.ndarray
    eligible_return_mask: np.ndarray
    train_mask: np.ndarray
    validation_mask: np.ndarray
    test_mask: np.ndarray
    tpp_rates: np.ndarray
    tpp_accrual_days: np.ndarray
    session_accrual_days: np.ndarray

    @classmethod
    def from_config(cls, config: dict) -> "HistoricalMarket":
        tickers = list(config["universe"]["tickers"])
        data_cfg = config["data"]
        prices = pd.read_parquet(config["paths"]["equity_prices"]).copy()
        required = {"instrument_id", "date", "source_close", "available_from", "source_quality_eligible"}
        missing = required.difference(prices.columns)
        if missing:
            raise ValueError(f"Equity data missing fields: {sorted(missing)}")
        prices["date"] = pd.to_datetime(prices["date"], errors="raise")
        prices["available_from"] = pd.to_datetime(prices["available_from"], errors="raise")
        prices["source_close"] = pd.to_numeric(prices["source_close"], errors="coerce")
        prices = prices[
            prices["instrument_id"].isin(tickers)
            & (prices["date"] >= pd.Timestamp(data_cfg["ignore_before"]))
            & (prices["date"] <= pd.Timestamp(data_cfg["relocked_test_end"]))
            & prices["source_quality_eligible"].fillna(False)
        ].copy()
        if prices.duplicated(["instrument_id", "date"]).any():
            raise ValueError("Duplicate equity instrument/date rows are forbidden")
        if bool(data_cfg["available_from_required"]) and prices["available_from"].isna().any():
            raise ValueError("Equity available_from is required")
        if (prices["available_from"] < prices["date"]).any():
            raise ValueError("Equity available_from precedes its source date")
        prices["rejected_flag"] = prices.get("quality_flags", "").map(_quality_has_rejected_flag)
        pivot = prices.pivot(index="date", columns="instrument_id", values="source_close")
        pivot = pivot.reindex(columns=tickers).dropna(how="any").sort_index()
        if len(pivot) < 1000:
            raise ValueError("Insufficient complete history for the fixed 16-equity universe")

        fx = pd.read_parquet(config["paths"]["fx_daily"]).copy()
        fx["date"] = pd.to_datetime(fx["date"], errors="raise")
        fx["available_from"] = pd.to_datetime(fx["available_from"], errors="raise")
        fx["usd_try_mid"] = pd.to_numeric(fx["usd_try_mid"], errors="coerce")
        fx = fx.dropna(subset=["available_from", "usd_try_mid"]).sort_values("available_from")
        if (fx["available_from"] < fx["date"]).any():
            raise ValueError("FX available_from precedes its source date")
        decision_frame = pd.DataFrame({"decision_date": pivot.index}).sort_values("decision_date")
        fx_known = pd.merge_asof(
            decision_frame,
            fx[["available_from", "usd_try_mid"]],
            left_on="decision_date",
            right_on="available_from",
            direction="backward",
            allow_exact_matches=True,
        )
        if fx_known["usd_try_mid"].isna().any():
            raise ValueError("FX could not be causally aligned without a future fill")

        close_values = pivot.to_numpy(dtype=np.float64)
        fx_values = fx_known["usd_try_mid"].to_numpy(dtype=np.float64)
        log_returns = np.diff(np.log(close_values), axis=0)
        fx_returns = np.diff(np.log(fx_values))
        return_dates = pivot.index.to_numpy()[1:]
        threshold = float(data_cfg["reject_abs_daily_return_over"])
        invalid = np.any(np.abs(log_returns) > threshold, axis=1)
        flagged_dates = set(prices.loc[prices["rejected_flag"], "date"].to_numpy())
        invalid |= np.asarray([date in flagged_dates for date in return_dates], dtype=bool)
        neighbor = int(data_cfg["mask_neighbor_sessions"])
        expanded = invalid.copy()
        for offset in range(1, neighbor + 1):
            expanded[offset:] |= invalid[:-offset]
            expanded[:-offset] |= invalid[offset:]
        eligible = ~expanded & np.isfinite(log_returns).all(axis=1) & np.isfinite(fx_returns)

        train_mask = (
            (return_dates >= np.datetime64(data_cfg["train_start"]))
            & (return_dates <= np.datetime64(data_cfg["train_end"]))
            & eligible
        )
        validation_mask = (
            (return_dates >= np.datetime64(data_cfg["validation_start"]))
            & (return_dates <= np.datetime64(data_cfg["validation_end"]))
            & eligible
        )
        test_mask = (
            (return_dates >= np.datetime64(data_cfg["relocked_test_start"]))
            & (return_dates <= np.datetime64(data_cfg["relocked_test_end"]))
            & eligible
        )
        if int(train_mask.sum()) < 1000:
            raise ValueError("Training window has fewer than 1000 eligible sessions")
        market_returns = log_returns.mean(axis=1)
        down = np.minimum(market_returns, 0.0)
        up = np.maximum(market_returns, 0.0)
        design = np.column_stack([np.ones(len(market_returns)), down, up, fx_returns])
        ridge = float(data_cfg["ridge_alpha"])
        x_train = design[train_mask]
        y_train = log_returns[train_mask]
        penalty = np.eye(design.shape[1]) * ridge
        penalty[0, 0] = 0.0
        coefficients = np.linalg.solve(x_train.T @ x_train + penalty, x_train.T @ y_train)
        residuals = log_returns - design @ coefficients
        residuals -= np.nanmean(residuals[train_mask], axis=0, keepdims=True)

        tpp = pd.read_parquet(config["paths"]["tpp_overnight"]).copy()
        tpp["data_date"] = pd.to_datetime(tpp["data_date"], errors="raise")
        tpp["available_from"] = pd.to_datetime(tpp["available_from"], errors="raise")
        tpp["weighted_average"] = pd.to_numeric(tpp["weighted_average"], errors="coerce")
        tpp["calendar_accrual_days"] = pd.to_numeric(tpp["calendar_accrual_days"], errors="coerce")
        tpp = tpp[
            tpp["eligible_curve_feature"].fillna(False)
            & (tpp["weighted_average"] > 0)
            & (tpp["available_from"] <= pd.Timestamp(data_cfg["train_end"]))
            & (tpp["data_date"] >= pd.Timestamp("2022-01-01"))
        ].dropna(subset=["weighted_average", "calendar_accrual_days"])
        if len(tpp) < 250:
            raise ValueError("Training-only TPP pool is too short")

        calendar = pd.read_parquet(config["paths"]["trading_calendar"]).copy()
        calendar["date"] = pd.to_datetime(calendar["date"], errors="raise")
        sessions = calendar.loc[calendar["is_observed_equity_session"], "date"].sort_values()
        session_gaps = sessions.diff().dt.days.fillna(1).clip(1, 7).to_numpy(dtype=np.int32)

        return cls(
            tickers=tickers,
            dates=pivot.index.to_numpy(),
            closes=close_values,
            returns=log_returns,
            fx_levels=fx_values,
            fx_returns=fx_returns,
            market_returns=market_returns,
            model_coefficients=coefficients,
            residuals=residuals,
            eligible_return_mask=eligible,
            train_mask=train_mask,
            validation_mask=validation_mask,
            test_mask=test_mask,
            tpp_rates=tpp["weighted_average"].to_numpy(dtype=np.float64),
            tpp_accrual_days=tpp["calendar_accrual_days"].to_numpy(dtype=np.int32),
            session_accrual_days=session_gaps,
        )

    def contiguous_start(self, rng: np.random.Generator, length: int, split: str = "train") -> int:
        mask = {
            "train": self.train_mask,
            "validation": self.validation_mask,
            "test": self.test_mask,
        }[split]
        candidates = []
        for start in range(0, len(mask) - length + 1):
            if bool(mask[start : start + length].all()):
                candidates.append(start)
        if not candidates:
            raise ValueError(f"No contiguous {length}-session block in {split}")
        return int(rng.choice(np.asarray(candidates)))

    def sample_joint_residuals(
        self, rng: np.random.Generator, length: int, block_length: int
    ) -> np.ndarray:
        parts: list[np.ndarray] = []
        while sum(len(part) for part in parts) < length:
            start = self.contiguous_start(rng, block_length, "train")
            parts.append(self.residuals[start : start + block_length])
        return np.vstack(parts)[:length].copy()

    def sample_tpp(self, rng: np.random.Generator, length: int) -> tuple[np.ndarray, np.ndarray]:
        indices = rng.integers(0, len(self.tpp_rates), size=length)
        rates = self.tpp_rates[indices]
        days = self.tpp_accrual_days[indices]
        return rates.astype(np.float64), days.astype(np.int32)


def write_data_manifest(config: dict, market: HistoricalMarket) -> Path:
    output = Path(config["paths"]["artifacts_dir"]) / "data_manifest_v2.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    keys = ["equity_prices", "fx_daily", "tpp_overnight", "trading_calendar", "instrument_master"]
    payload = {
        "tickers": market.tickers,
        "sessions": int(len(market.dates)),
        "first_date": str(market.dates[0])[:10],
        "last_date": str(market.dates[-1])[:10],
        "eligible_train_returns": int(market.train_mask.sum()),
        "eligible_validation_returns": int(market.validation_mask.sum()),
        "eligible_test_returns": int(market.test_mask.sum()),
        "asymmetric_factor_coefficients": market.model_coefficients.tolist(),
        "files": [_fingerprint(config["paths"][key]) for key in keys],
    }
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    args = parser.parse_args()
    config = load_config(args.config)
    market = HistoricalMarket.from_config(config)
    print(write_data_manifest(config, market))


if __name__ == "__main__":
    main()
