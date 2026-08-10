from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


def _percentile_rank(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=np.float64)
    order = np.argsort(values, kind="stable")
    ranks = np.empty(len(values), dtype=np.float64)
    ranks[order] = np.arange(len(values), dtype=np.float64)
    return ranks / max(1, len(values) - 1)


def _huber_ridge(x: np.ndarray, y: np.ndarray, alpha: float) -> np.ndarray:
    """Small deterministic Huber IRLS fit; avoids an sklearn dependency."""
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    weights = np.ones(len(y), dtype=np.float64)
    penalty = np.eye(x.shape[1], dtype=np.float64) * float(alpha)
    penalty[0, 0] = 0.0
    beta = np.zeros(x.shape[1], dtype=np.float64)
    for _ in range(20):
        xtw = x.T * weights
        candidate = np.linalg.solve(xtw @ x + penalty, xtw @ y)
        residual = y - x @ candidate
        scale = 1.4826 * np.median(np.abs(residual - np.median(residual))) + 1e-12
        cutoff = 1.35 * scale
        new_weights = np.minimum(1.0, cutoff / np.maximum(np.abs(residual), 1e-12))
        if np.max(np.abs(candidate - beta)) < 1e-10:
            beta = candidate
            break
        beta = candidate
        weights = new_weights
    return beta


def _trimmed_row_mean(values: np.ndarray, fraction: float) -> np.ndarray:
    result = np.empty(values.shape[0], dtype=np.float64)
    for row_index, row in enumerate(values):
        usable = np.sort(row[np.isfinite(row)])
        cut = int(np.floor(len(usable) * float(fraction)))
        if len(usable) - 2 * cut < 5:
            result[row_index] = float(np.nanmean(usable))
        else:
            result[row_index] = float(np.mean(usable[cut : len(usable) - cut]))
    return result


@dataclass(frozen=True)
class EventProfile:
    scenario_id: str
    active_start: str
    active_end: str
    market_returns: np.ndarray
    asset_loading: np.ndarray
    asset_uncertainty: np.ndarray
    downside_beta: np.ndarray
    terminal_returns: np.ndarray
    max_drawdowns: np.ndarray


@dataclass
class V22MarketData:
    tickers: list[str]
    dates: np.ndarray
    closes: np.ndarray
    returns: np.ndarray
    usd_levels: np.ndarray
    eur_levels: np.ndarray
    usd_returns: np.ndarray
    eur_returns: np.ndarray
    market_returns: np.ndarray
    sector_returns: np.ndarray
    coefficients: np.ndarray
    residuals: np.ndarray
    train_downside_beta: np.ndarray
    eligible_mask: np.ndarray
    train_mask: np.ndarray
    validation_mask: np.ndarray
    test_mask: np.ndarray
    return_dates: np.ndarray
    session_accrual_days: np.ndarray
    tpp_rates: np.ndarray
    tpp_accrual_days: np.ndarray
    event_profiles: dict[str, EventProfile]

    @classmethod
    def from_config(cls, config: dict) -> "V22MarketData":
        tickers = list(config["universe"]["tickers"])
        data_cfg = config["data"]
        prices = pd.read_parquet(config["paths"]["equity_prices"]).copy()
        prices["date"] = pd.to_datetime(prices["date"], errors="raise")
        prices["available_from"] = pd.to_datetime(prices["available_from"], errors="raise")
        prices["source_close"] = pd.to_numeric(prices["source_close"], errors="coerce")
        prices = prices[
            prices["source_quality_eligible"].fillna(False)
            & (prices["date"] >= pd.Timestamp(data_cfg["ignore_before"]))
            & (prices["date"] <= pd.Timestamp(data_cfg["relocked_test_end"]))
        ].copy()
        if prices.duplicated(["instrument_id", "date"]).any():
            raise ValueError("Duplicate equity instrument/date rows are forbidden")
        if prices["available_from"].isna().any() or (prices["available_from"] < prices["date"]).any():
            raise ValueError("Invalid equity available_from lineage")

        fixed = (
            prices[prices["instrument_id"].isin(tickers)]
            .pivot(index="date", columns="instrument_id", values="source_close")
            .reindex(columns=tickers)
            .dropna(how="any")
            .sort_index()
        )
        all_equities = (
            prices.pivot(index="date", columns="instrument_id", values="source_close")
            .reindex(index=fixed.index)
            .sort_index()
        )
        if len(fixed) < 2000:
            raise ValueError("V2.2 requires at least 2000 common fixed-universe sessions")
        closes = fixed.to_numpy(dtype=np.float64)
        log_returns = np.diff(np.log(closes), axis=0)
        all_values = all_equities.to_numpy(dtype=np.float64)
        all_log_returns = np.diff(np.log(all_values), axis=0)
        threshold = float(data_cfg["reject_abs_daily_return_over"])
        all_log_returns[np.abs(all_log_returns) > threshold] = np.nan
        market_returns = _trimmed_row_mean(
            all_log_returns, float(data_cfg.get("market_trim_each_tail", 0.10))
        )

        metadata = pd.read_parquet(config["paths"]["instrument_master"])
        sectors = metadata.set_index("instrument_id")["sector_code"].to_dict()
        all_columns = list(all_equities.columns)
        column_index = {name: idx for idx, name in enumerate(all_columns)}
        sector_returns = np.zeros_like(log_returns)
        for asset_index, ticker in enumerate(tickers):
            peers = [
                column_index[name]
                for name in all_columns
                if name != ticker and sectors.get(name) == sectors.get(ticker)
            ]
            if peers:
                peer_values = all_log_returns[:, peers]
                peer_count = np.sum(np.isfinite(peer_values), axis=1)
                peer_mean = np.divide(
                    np.nansum(peer_values, axis=1),
                    peer_count,
                    out=np.full(len(peer_values), np.nan, dtype=np.float64),
                    where=peer_count > 0,
                )
                peer_mean = np.where(np.isfinite(peer_mean), peer_mean, market_returns)
                sector_returns[:, asset_index] = peer_mean - market_returns

        fx = pd.read_parquet(config["paths"]["fx_daily"]).copy()
        fx["available_from"] = pd.to_datetime(fx["available_from"], errors="raise")
        fx["usd_try_mid"] = pd.to_numeric(fx["usd_try_mid"], errors="coerce")
        fx["eur_try_mid"] = pd.to_numeric(fx["eur_try_mid"], errors="coerce")
        fx = fx.dropna(subset=["available_from", "usd_try_mid", "eur_try_mid"]).sort_values("available_from")
        decision = pd.DataFrame({"decision_date": fixed.index}).sort_values("decision_date")
        known = pd.merge_asof(
            decision,
            fx[["available_from", "usd_try_mid", "eur_try_mid"]],
            left_on="decision_date",
            right_on="available_from",
            direction="backward",
            allow_exact_matches=True,
        )
        if known[["usd_try_mid", "eur_try_mid"]].isna().any().any():
            raise ValueError("FX could not be aligned causally")
        usd_levels = known["usd_try_mid"].to_numpy(dtype=np.float64)
        eur_levels = known["eur_try_mid"].to_numpy(dtype=np.float64)
        usd_returns = np.diff(np.log(usd_levels))
        eur_returns = np.diff(np.log(eur_levels))

        return_dates = fixed.index.to_numpy()[1:]
        invalid = (
            np.any(np.abs(log_returns) > threshold, axis=1)
            | ~np.isfinite(log_returns).all(axis=1)
            | ~np.isfinite(market_returns)
            | ~np.isfinite(usd_returns)
            | ~np.isfinite(eur_returns)
        )
        neighbor = int(data_cfg.get("mask_neighbor_sessions", 1))
        expanded = invalid.copy()
        for offset in range(1, neighbor + 1):
            expanded[offset:] |= invalid[:-offset]
            expanded[:-offset] |= invalid[offset:]
        eligible = ~expanded
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
            raise ValueError("Insufficient eligible V2.2 training sessions")

        coefficients = np.zeros((len(tickers), 5), dtype=np.float64)
        residuals = np.zeros_like(log_returns)
        alpha = float(data_cfg.get("ridge_alpha", 1e-4))
        for asset_index in range(len(tickers)):
            design = np.column_stack(
                [
                    np.ones(len(market_returns)),
                    np.minimum(market_returns, 0.0),
                    np.maximum(market_returns, 0.0),
                    usd_returns,
                    sector_returns[:, asset_index],
                ]
            )
            beta = _huber_ridge(design[train_mask], log_returns[train_mask, asset_index], alpha)
            coefficients[asset_index] = beta
            residuals[:, asset_index] = log_returns[:, asset_index] - design @ beta
        residuals -= np.mean(residuals[train_mask], axis=0, keepdims=True)
        train_downside_beta = np.clip(coefficients[:, 1], 0.25, 2.0)

        calendar = pd.read_parquet(config["paths"]["trading_calendar"]).copy()
        calendar["date"] = pd.to_datetime(calendar["date"], errors="raise")
        sessions = calendar.loc[calendar["is_observed_equity_session"], "date"].sort_values()
        gaps_by_date = sessions.diff().dt.days.fillna(1).clip(1, 7)
        gap_map = dict(zip(sessions.dt.normalize(), gaps_by_date.astype(int)))
        session_accrual_days = np.asarray(
            [gap_map.get(pd.Timestamp(date).normalize(), 1) for date in return_dates], dtype=np.int32
        )

        tpp = pd.read_parquet(config["paths"]["tpp_overnight"]).copy()
        tpp["data_date"] = pd.to_datetime(tpp["data_date"], errors="raise")
        tpp["weighted_average"] = pd.to_numeric(tpp["weighted_average"], errors="coerce")
        tpp["calendar_accrual_days"] = pd.to_numeric(tpp["calendar_accrual_days"], errors="coerce")
        tpp = tpp[
            tpp["eligible_curve_feature"].fillna(False)
            & (tpp["weighted_average"] > 0)
            & (tpp["data_date"] <= pd.Timestamp(data_cfg["train_end"]))
        ].dropna(subset=["weighted_average", "calendar_accrual_days"])

        temporary = cls(
            tickers=tickers,
            dates=fixed.index.to_numpy(),
            closes=closes,
            returns=log_returns,
            usd_levels=usd_levels,
            eur_levels=eur_levels,
            usd_returns=usd_returns,
            eur_returns=eur_returns,
            market_returns=market_returns,
            sector_returns=sector_returns,
            coefficients=coefficients,
            residuals=residuals,
            train_downside_beta=train_downside_beta,
            eligible_mask=eligible,
            train_mask=train_mask,
            validation_mask=validation_mask,
            test_mask=test_mask,
            return_dates=return_dates,
            session_accrual_days=session_accrual_days,
            tpp_rates=tpp["weighted_average"].to_numpy(dtype=np.float64),
            tpp_accrual_days=tpp["calendar_accrual_days"].to_numpy(dtype=np.int32),
            event_profiles={},
        )
        temporary.event_profiles = temporary._build_event_profiles(config)
        return temporary

    def _build_event_profiles(self, config: dict) -> dict[str, EventProfile]:
        equity_weights = np.asarray(
            [config["universe"]["initial_weights"][ticker] for ticker in self.tickers], dtype=np.float64
        )
        equity_weights /= equity_weights.sum()
        result: dict[str, EventProfile] = {}
        reps = int(config["data"].get("event_bootstrap_reps", 250))
        for scenario_index, (scenario_id, event) in enumerate(config["data"]["events"].items()):
            mask = (
                (self.return_dates >= np.datetime64(event["active_start"]))
                & (self.return_dates <= np.datetime64(event["active_end"]))
            )
            returns = self.returns[mask]
            market = self.market_returns[mask]
            levels = np.vstack([np.ones(len(self.tickers)), np.exp(np.cumsum(returns, axis=0))])
            terminal = levels[-1] - 1.0
            drawdowns = 1.0 - levels / np.maximum.accumulate(levels, axis=0)
            max_drawdowns = np.max(drawdowns, axis=0)
            proxy_level = levels @ equity_weights
            proxy_returns = np.diff(np.log(proxy_level))
            downside_beta = np.empty(len(self.tickers), dtype=np.float64)
            negative = proxy_returns < 0
            for asset_index in range(len(self.tickers)):
                x = proxy_returns[negative]
                y = returns[negative, asset_index]
                downside_beta[asset_index] = (
                    float(np.dot(x, y) / max(np.dot(x, x), 1e-12)) if len(x) else self.train_downside_beta[asset_index]
                )
            q = (
                0.45 * _percentile_rank(-terminal)
                + 0.30 * _percentile_rank(max_drawdowns)
                + 0.25 * _percentile_rank(downside_beta)
            )
            loading = 2.0 * _percentile_rank(q) - 1.0

            rng = np.random.default_rng(20260809 + scenario_index)
            rank_samples = np.empty((reps, len(self.tickers)), dtype=np.float64)
            block = 3
            for rep in range(reps):
                indices: list[int] = []
                while len(indices) < len(returns):
                    start = int(rng.integers(0, len(returns)))
                    indices.extend([(start + offset) % len(returns) for offset in range(block)])
                sample = returns[np.asarray(indices[: len(returns)])]
                sample_levels = np.vstack([np.ones(len(self.tickers)), np.exp(np.cumsum(sample, axis=0))])
                sample_terminal = sample_levels[-1] - 1.0
                sample_mdd = np.max(
                    1.0 - sample_levels / np.maximum.accumulate(sample_levels, axis=0), axis=0
                )
                sample_proxy = sample_levels @ equity_weights
                sample_proxy_returns = np.diff(np.log(sample_proxy))
                negative_sample = sample_proxy_returns < 0
                sample_beta = np.empty(len(self.tickers), dtype=np.float64)
                for asset_index in range(len(self.tickers)):
                    x = sample_proxy_returns[negative_sample]
                    y = sample[negative_sample, asset_index]
                    sample_beta[asset_index] = (
                        float(np.dot(x, y) / max(np.dot(x, x), 1e-12))
                        if len(x)
                        else self.train_downside_beta[asset_index]
                    )
                sample_q = (
                    0.45 * _percentile_rank(-sample_terminal)
                    + 0.30 * _percentile_rank(sample_mdd)
                    + 0.25 * _percentile_rank(sample_beta)
                )
                rank_samples[rep] = _percentile_rank(sample_q)
            uncertainty = np.std(rank_samples, axis=0, ddof=0)
            result[scenario_id] = EventProfile(
                scenario_id=scenario_id,
                active_start=str(event["active_start"]),
                active_end=str(event["active_end"]),
                market_returns=market.copy(),
                asset_loading=loading,
                asset_uncertainty=uncertainty,
                downside_beta=downside_beta,
                terminal_returns=terminal,
                max_drawdowns=max_drawdowns,
            )
        return result

    def contiguous_start(self, rng: np.random.Generator, length: int, split: str) -> int:
        mask = {"train": self.train_mask, "validation": self.validation_mask, "test": self.test_mask}[split]
        candidates = [start for start in range(len(mask) - length + 1) if bool(mask[start : start + length].all())]
        if not candidates:
            raise ValueError(f"No contiguous {length}-return block in {split}")
        return int(rng.choice(np.asarray(candidates, dtype=np.int64)))

    def sample_joint_blocks(
        self, rng: np.random.Generator, length: int, block_length: int
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        residual_parts: list[np.ndarray] = []
        usd_parts: list[np.ndarray] = []
        eur_parts: list[np.ndarray] = []
        gap_parts: list[np.ndarray] = []
        while sum(len(part) for part in residual_parts) < length:
            start = self.contiguous_start(rng, block_length, "train")
            stop = start + block_length
            residual_parts.append(self.residuals[start:stop])
            usd_parts.append(self.usd_returns[start:stop])
            eur_parts.append(self.eur_returns[start:stop])
            gap_parts.append(self.session_accrual_days[start:stop])
        return (
            np.vstack(residual_parts)[:length].copy(),
            np.concatenate(usd_parts)[:length].copy(),
            np.concatenate(eur_parts)[:length].copy(),
            np.concatenate(gap_parts)[:length].astype(np.int32, copy=True),
        )


def data_contract(config: dict, market: V22MarketData) -> dict:
    return {
        "schema_version": "bist_stress_rl_v22_data",
        "tickers": market.tickers,
        "first_date": str(market.dates[0])[:10],
        "last_date": str(market.dates[-1])[:10],
        "common_sessions": int(len(market.dates)),
        "eligible_train_returns": int(market.train_mask.sum()),
        "eligible_validation_returns": int(market.validation_mask.sum()),
        "events": {
            name: {
                "active_start": profile.active_start,
                "active_end": profile.active_end,
                "asset_loading": profile.asset_loading.tolist(),
                "asset_uncertainty": profile.asset_uncertainty.tolist(),
                "terminal_returns": profile.terminal_returns.tolist(),
                "max_drawdowns": profile.max_drawdowns.tolist(),
            }
            for name, profile in market.event_profiles.items()
        },
        "source_paths": {
            key: str(Path(config["paths"][key]).resolve())
            for key in ["equity_prices", "fx_daily", "tpp_overnight", "trading_calendar", "instrument_master"]
        },
    }
