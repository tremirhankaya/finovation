from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd


DEFAULT_SOURCE_START = pd.Timestamp("2017-07-01")
DEFAULT_CUTOFF = pd.Timestamp("2025-05-28")
LOOKBACK = 252

BASE_EQUITY_PREDICTORS = [
    "source_log_return_1",
    "source_log_return_5",
    "source_log_return_20",
    "source_log_return_60",
    "source_log_return_126",
    "source_log_return_252",
    "source_intraday_log_range",
    "source_close_to_open_log_return",
    "source_realized_volatility_20",
    "source_realized_volatility_60",
    "source_downside_volatility_20",
    "source_downside_volatility_60",
    "source_drawdown_from_60_session_peak",
    "source_drawdown_from_252_session_peak",
    "cross_section_momentum_20_percentile",
    "cross_section_positive_return_breadth",
    "cross_section_return_dispersion",
]

TECHNICAL_PREDICTORS = [
    "source_momentum_12_1",
    "source_ma5_ma20_ratio",
    "source_close_ma50_ratio",
    "source_close_ma200_ratio",
    "source_rsi_14",
    "source_bollinger_pct_b_20",
    "source_bollinger_bandwidth_20",
    "source_adx_14",
    "source_directional_index_spread_14",
    "source_parkinson_volatility_20",
    "source_overnight_gap_1",
    "source_positive_day_ratio_20",
    "source_max_daily_log_return_20",
    "source_return_skewness_60",
    "source_distance_from_252_session_low",
    "source_volatility_ratio_20_60",
]

UNIVERSE_PREDICTORS = [
    "universe58_loo_log_return_1",
    "universe58_loo_log_return_20",
    "universe58_loo_log_return_60",
    "universe58_loo_log_return_126",
    "universe58_loo_realized_volatility_20",
    "universe58_loo_drawdown_252",
    "source_beta_universe58_60",
    "source_beta_universe58_252",
    "source_correlation_universe58_60",
    "source_residual_momentum_20",
    "source_residual_momentum_126",
    "source_idiosyncratic_volatility_60",
    "cross_section_momentum_126_percentile",
    "cross_section_momentum_252_percentile",
    "cross_section_volatility_60_percentile",
    "cross_section_beta_60_percentile",
]

TPP_PREDICTORS = [
    "tpp_day1_weighted_average",
    "tpp_day1_close_rate",
    "tpp_day1_high_low_spread",
    "tpp_day1_rate_change_1_observed",
    "tpp_day1_rate_change_5_observed",
    "tpp_day1_rate_change_20_observed",
    "tpp_day1_rate_change_volatility_20",
    "tpp_day1_rate_vs_ma20",
    "tpp_day1_log_volume_try",
    "tpp_day1_log_transaction_count",
    "tpp_day1_log_average_ticket_try",
    "tpp_observation_age_calendar_days",
    "tpp_available",
    "tpp_observed_same_day",
    "tpp_source_zero_weighted_average",
]

PREDICTORS = BASE_EQUITY_PREDICTORS + TECHNICAL_PREDICTORS + UNIVERSE_PREDICTORS + TPP_PREDICTORS


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    result = numerator / denominator.replace(0.0, np.nan)
    return result.replace([np.inf, -np.inf], np.nan)


def group_rolling(series: pd.Series, groups: pd.Series, window: int, op: str) -> pd.Series:
    rolling = series.groupby(groups, sort=False).rolling(window, min_periods=window)
    if op == "mean":
        value = rolling.mean()
    elif op == "std":
        value = rolling.std(ddof=0)
    elif op == "sum":
        value = rolling.sum()
    elif op == "max":
        value = rolling.max()
    elif op == "min":
        value = rolling.min()
    elif op == "skew":
        value = rolling.skew()
    else:
        raise ValueError(op)
    return value.reset_index(level=0, drop=True).sort_index()


def rolling_covariance(
    left: pd.Series, right: pd.Series, groups: pd.Series, window: int
) -> tuple[pd.Series, pd.Series, pd.Series]:
    work = pd.DataFrame({"group": groups, "left": left, "right": right})

    def calculate(part: pd.DataFrame) -> pd.DataFrame:
        cov = part["left"].rolling(window, min_periods=window).cov(part["right"], ddof=0)
        var = part["right"].rolling(window, min_periods=window).var(ddof=0)
        corr = part["left"].rolling(window, min_periods=window).corr(part["right"])
        return pd.DataFrame({"cov": cov, "var": var, "corr": corr}, index=part.index)

    result = work.groupby("group", sort=False, group_keys=False).apply(
        calculate, include_groups=False
    )
    return result["cov"].sort_index(), result["var"].sort_index(), result["corr"].sort_index()


def add_adx(frame: pd.DataFrame) -> None:
    def one_instrument(part: pd.DataFrame) -> pd.DataFrame:
        high = part["source_high"]
        low = part["source_low"]
        close = part["source_close"]
        up = high.diff()
        down = -low.diff()
        plus_dm = pd.Series(np.where((up > down) & (up > 0), up, 0.0), index=part.index)
        minus_dm = pd.Series(np.where((down > up) & (down > 0), down, 0.0), index=part.index)
        previous_close = close.shift(1)
        true_range = pd.concat(
            [high - low, (high - previous_close).abs(), (low - previous_close).abs()], axis=1
        ).max(axis=1)
        alpha = 1.0 / 14.0
        atr = true_range.ewm(alpha=alpha, adjust=False, min_periods=14).mean()
        plus_di = 100.0 * safe_ratio(
            plus_dm.ewm(alpha=alpha, adjust=False, min_periods=14).mean(), atr
        )
        minus_di = 100.0 * safe_ratio(
            minus_dm.ewm(alpha=alpha, adjust=False, min_periods=14).mean(), atr
        )
        dx = 100.0 * safe_ratio((plus_di - minus_di).abs(), plus_di + minus_di)
        return pd.DataFrame(
            {
                "source_adx_14": dx.ewm(alpha=alpha, adjust=False, min_periods=14).mean(),
                "source_directional_index_spread_14": plus_di - minus_di,
            },
            index=part.index,
        )

    values = frame.groupby("instrument_id", sort=False, group_keys=False).apply(
        one_instrument, include_groups=False
    )
    frame["source_adx_14"] = values["source_adx_14"].sort_index()
    frame["source_directional_index_spread_14"] = values[
        "source_directional_index_spread_14"
    ].sort_index()


def build_equity_features(
    equity_path: Path,
    gap_path: Path,
    jump_path: Path,
    source_start: pd.Timestamp,
    cutoff: pd.Timestamp,
) -> pd.DataFrame:
    columns = [
        "instrument_id",
        "date",
        "source_open",
        "source_high",
        "source_low",
        "source_close",
        "available_from",
        "source_quality_eligible",
    ]
    frame = pd.read_parquet(equity_path, columns=columns)
    frame["as_of_date"] = pd.to_datetime(frame.pop("date"))
    frame = frame.loc[
        frame["as_of_date"].between(source_start, cutoff, inclusive="both")
    ].copy()
    frame["feature_available_from"] = pd.to_datetime(frame.pop("available_from"))
    frame["market_data_through_date"] = frame["as_of_date"]
    for column in ("source_open", "source_high", "source_low", "source_close"):
        frame[column] = pd.to_numeric(frame[column], errors="raise").astype("float64")
    frame.sort_values(["instrument_id", "as_of_date"], inplace=True)
    frame.reset_index(drop=True, inplace=True)

    groups = frame["instrument_id"]
    log_close = np.log(frame["source_close"])
    frame["source_log_return_1_calc"] = log_close.groupby(groups, sort=False).diff()
    for window in (5, 20, 60, 126, 252):
        frame[f"source_log_return_{window}_calc"] = log_close.groupby(groups, sort=False).diff(window)

    frame["source_log_return_1"] = frame["source_log_return_1_calc"]
    for window in (5, 20, 60, 126, 252):
        frame[f"source_log_return_{window}"] = frame[f"source_log_return_{window}_calc"]
    frame["source_intraday_log_range"] = np.log(
        frame["source_high"] / frame["source_low"]
    )
    frame["source_close_to_open_log_return"] = np.log(
        frame["source_close"] / frame["source_open"]
    )

    ma5 = group_rolling(frame["source_close"], groups, 5, "mean")
    ma20 = group_rolling(frame["source_close"], groups, 20, "mean")
    ma50 = group_rolling(frame["source_close"], groups, 50, "mean")
    ma200 = group_rolling(frame["source_close"], groups, 200, "mean")
    std20 = group_rolling(frame["source_close"], groups, 20, "std")
    upper = ma20 + 2.0 * std20
    lower = ma20 - 2.0 * std20

    frame["source_momentum_12_1"] = (
        frame["source_log_return_252_calc"] - frame["source_log_return_20_calc"]
    )
    frame["source_ma5_ma20_ratio"] = safe_ratio(ma5, ma20) - 1.0
    frame["source_close_ma50_ratio"] = safe_ratio(frame["source_close"], ma50) - 1.0
    frame["source_close_ma200_ratio"] = safe_ratio(frame["source_close"], ma200) - 1.0
    frame["source_bollinger_pct_b_20"] = safe_ratio(frame["source_close"] - lower, upper - lower)
    frame["source_bollinger_bandwidth_20"] = safe_ratio(upper - lower, ma20)

    daily = frame["source_log_return_1_calc"]
    downside_sq = daily.clip(upper=0.0).pow(2)
    for window in (20, 60):
        frame[f"source_realized_volatility_{window}"] = group_rolling(
            daily, groups, window, "std"
        )
        frame[f"source_downside_volatility_{window}"] = np.sqrt(
            group_rolling(downside_sq, groups, window, "mean")
        )
    for window in (60, 252):
        peak = group_rolling(frame["source_close"], groups, window, "max")
        frame[f"source_drawdown_from_{window}_session_peak"] = (
            safe_ratio(frame["source_close"], peak) - 1.0
        )

    frame["cross_section_momentum_20_percentile"] = frame.groupby("as_of_date")[
        "source_log_return_20"
    ].rank(pct=True)
    by_date = frame.groupby("as_of_date")["source_log_return_1"]
    observed = by_date.transform("count")
    positive = by_date.transform(lambda values: int((values.dropna() > 0).sum()))
    frame["cross_section_positive_return_breadth"] = np.where(
        observed > 0, positive / observed, np.nan
    )
    frame["cross_section_return_dispersion"] = by_date.transform(
        lambda values: values.std(ddof=0)
    )

    gains = daily.clip(lower=0.0)
    losses = -daily.clip(upper=0.0)
    avg_gain = group_rolling(gains, groups, 14, "mean")
    avg_loss = group_rolling(losses, groups, 14, "mean")
    rs = safe_ratio(avg_gain, avg_loss)
    rsi = 100.0 - 100.0 / (1.0 + rs)
    rsi = rsi.where(~((avg_loss == 0.0) & (avg_gain > 0.0)), 100.0)
    rsi = rsi.where(~((avg_loss == 0.0) & (avg_gain == 0.0)), 50.0)
    frame["source_rsi_14"] = rsi

    add_adx(frame)
    log_range_squared = np.log(frame["source_high"] / frame["source_low"]).pow(2)
    frame["source_parkinson_volatility_20"] = np.sqrt(
        group_rolling(log_range_squared, groups, 20, "mean") / (4.0 * np.log(2.0))
    )
    previous_close = frame["source_close"].groupby(groups, sort=False).shift(1)
    frame["source_overnight_gap_1"] = np.log(frame["source_open"] / previous_close)
    frame["source_positive_day_ratio_20"] = group_rolling(
        daily.gt(0).astype("float64"), groups, 20, "mean"
    )
    frame["source_max_daily_log_return_20"] = group_rolling(daily, groups, 20, "max")
    frame["source_return_skewness_60"] = group_rolling(daily, groups, 60, "skew")
    low252 = group_rolling(frame["source_close"], groups, 252, "min")
    frame["source_distance_from_252_session_low"] = safe_ratio(frame["source_close"], low252) - 1.0
    vol20 = group_rolling(daily, groups, 20, "std")
    vol60 = group_rolling(daily, groups, 60, "std")
    frame["source_volatility_ratio_20_60"] = safe_ratio(vol20, vol60)

    by_date = frame.groupby("as_of_date")["source_log_return_1_calc"]
    daily_sum = by_date.transform("sum")
    daily_count = by_date.transform("count")
    own_observed = frame["source_log_return_1_calc"].notna()
    loo_denominator = daily_count - own_observed.astype("int64")
    loo_numerator = daily_sum - frame["source_log_return_1_calc"].fillna(0.0)
    frame["universe58_loo_log_return_1"] = np.where(
        loo_denominator > 0, loo_numerator / loo_denominator, np.nan
    )
    market = frame["universe58_loo_log_return_1"]
    for window in (20, 60, 126):
        frame[f"universe58_loo_log_return_{window}"] = group_rolling(
            market, groups, window, "sum"
        )
    frame["universe58_loo_realized_volatility_20"] = group_rolling(
        market, groups, 20, "std"
    )
    frame["universe58_loo_index"] = np.exp(market.groupby(groups, sort=False).cumsum())
    market_peak252 = group_rolling(frame["universe58_loo_index"], groups, 252, "max")
    frame["universe58_loo_drawdown_252"] = (
        safe_ratio(frame["universe58_loo_index"], market_peak252) - 1.0
    )

    cov60, var60, corr60 = rolling_covariance(daily, market, groups, 60)
    cov252, var252, _ = rolling_covariance(daily, market, groups, 252)
    frame["source_beta_universe58_60"] = safe_ratio(cov60, var60)
    frame["source_beta_universe58_252"] = safe_ratio(cov252, var252)
    frame["source_correlation_universe58_60"] = corr60
    frame["source_residual_momentum_20"] = (
        frame["source_log_return_20_calc"]
        - frame["source_beta_universe58_60"] * frame["universe58_loo_log_return_20"]
    )
    frame["source_residual_momentum_126"] = (
        frame["source_log_return_126_calc"]
        - frame["source_beta_universe58_252"] * frame["universe58_loo_log_return_126"]
    )
    frame["source_daily_market_residual"] = (
        daily - frame["source_beta_universe58_60"] * market
    )
    frame["source_idiosyncratic_volatility_60"] = group_rolling(
        frame["source_daily_market_residual"], groups, 60, "std"
    )

    frame["cross_section_momentum_126_percentile"] = frame.groupby("as_of_date")[
        "source_log_return_126_calc"
    ].rank(pct=True)
    frame["cross_section_momentum_252_percentile"] = frame.groupby("as_of_date")[
        "source_log_return_252_calc"
    ].rank(pct=True)
    frame["_vol60"] = vol60
    frame["cross_section_volatility_60_percentile"] = frame.groupby("as_of_date")[
        "_vol60"
    ].rank(pct=True)
    frame["cross_section_beta_60_percentile"] = frame.groupby("as_of_date")[
        "source_beta_universe58_60"
    ].rank(pct=True)

    frame["gap_lookback_mask"] = False
    frame["unresolved_jump_lookback_mask"] = False
    session_dates = sorted(frame["as_of_date"].drop_duplicates())
    session_ordinal = {date: index for index, date in enumerate(session_dates)}
    frame["_session_ordinal"] = frame["as_of_date"].map(session_ordinal).astype("int32")

    gaps = pd.read_csv(gap_path)
    active = gaps.loc[gaps["is_active_data_gap"].astype(str).str.lower().eq("true")].copy()
    for row in active.itertuples(index=False):
        start = pd.Timestamp(row.gap_start)
        end = pd.Timestamp(row.gap_end)
        if end < source_start or start > cutoff:
            continue
        covered = [value for value in session_dates if start <= value <= end]
        if not covered:
            continue
        start_ord = session_ordinal[covered[0]]
        end_ord = session_ordinal[covered[-1]]
        mask = (
            frame["instrument_id"].eq(row.ticker)
            & frame["_session_ordinal"].between(start_ord, end_ord + LOOKBACK - 1)
        )
        frame.loc[mask, "gap_lookback_mask"] = True

    jumps = pd.read_csv(jump_path, usecols=["ticker", "event_date", "classification"])
    jumps = jumps.loc[jumps["classification"].astype(str).eq("UNRESOLVED")].copy()
    for row in jumps.itertuples(index=False):
        event = pd.Timestamp(row.event_date)
        if event < source_start or event > cutoff or event not in session_ordinal:
            continue
        event_ord = session_ordinal[event]
        mask = (
            frame["instrument_id"].eq(row.ticker)
            & frame["_session_ordinal"].between(event_ord, event_ord + LOOKBACK - 1)
        )
        frame.loc[mask, "unresolved_jump_lookback_mask"] = True

    frame["history_observation_count_from_2017_07"] = (
        frame.groupby("instrument_id", sort=False).cumcount() + 1
    ).astype("int32")
    equity_predictors = BASE_EQUITY_PREDICTORS + TECHNICAL_PREDICTORS + UNIVERSE_PREDICTORS
    finite = np.isfinite(frame[equity_predictors].to_numpy(dtype="float64")).all(axis=1)
    frame["feature_eligible"] = (
        frame["history_observation_count_from_2017_07"].ge(253)
        & frame["source_quality_eligible"].astype(bool)
        & ~frame["gap_lookback_mask"]
        & ~frame["unresolved_jump_lookback_mask"]
        & finite
    )
    output_columns = [
        "instrument_id",
        "as_of_date",
        "market_data_through_date",
        "feature_available_from",
        "feature_eligible",
        "history_observation_count_from_2017_07",
        "gap_lookback_mask",
        "unresolved_jump_lookback_mask",
    ] + equity_predictors
    return frame[output_columns].copy()


def build_tpp_state(equity_dates: pd.Series) -> pd.DataFrame:
    tpp = pd.read_parquet(TPP_PATH)
    tpp["data_date"] = pd.to_datetime(tpp["data_date"])
    tpp = tpp.loc[tpp["data_date"] <= CUTOFF].sort_values("data_date").copy()
    if len(tpp) != tpp["data_date"].nunique() or not tpp["tenor_day_source"].eq(1).all():
        raise RuntimeError("TPP source is not unique day=1 observed data")
    if not tpp["source_file"].eq("tpp_oran_2000_2026-08-01.csv").all():
        raise RuntimeError("Unexpected TPP source lineage")
    numeric = [
        "weighted_average",
        "close_rate",
        "high_rate",
        "low_rate",
        "trading_volume_try",
        "transaction_count",
    ]
    for column in numeric:
        tpp[column] = pd.to_numeric(tpp[column], errors="raise").astype("float64")
    tpp["tpp_day1_weighted_average"] = tpp["weighted_average"]
    tpp["tpp_day1_close_rate"] = tpp["close_rate"]
    tpp["tpp_day1_high_low_spread"] = tpp["high_rate"] - tpp["low_rate"]
    rate = tpp["weighted_average"]
    for lag in (1, 5, 20):
        tpp[f"tpp_day1_rate_change_{lag}_observed"] = rate.diff(lag)
    tpp["tpp_day1_rate_change_volatility_20"] = rate.diff().rolling(20, min_periods=20).std(ddof=0)
    tpp["tpp_day1_rate_vs_ma20"] = rate - rate.rolling(20, min_periods=20).mean()
    tpp["tpp_day1_log_volume_try"] = np.log1p(tpp["trading_volume_try"])
    tpp["tpp_day1_log_transaction_count"] = np.log1p(tpp["transaction_count"])
    average_ticket = safe_ratio(tpp["trading_volume_try"], tpp["transaction_count"])
    tpp["tpp_day1_log_average_ticket_try"] = np.log1p(average_ticket)
    tpp["tpp_source_zero_weighted_average"] = rate.eq(0.0).astype("int8")
    tpp.rename(columns={"data_date": "tpp_source_observation_date"}, inplace=True)

    dates = pd.DataFrame({"as_of_date": pd.to_datetime(pd.Series(equity_dates).drop_duplicates())})
    dates.sort_values("as_of_date", inplace=True)
    keep = ["tpp_source_observation_date"] + [
        name for name in TPP_PREDICTORS if name not in {
            "tpp_available", "tpp_observed_same_day", "tpp_observation_age_calendar_days"
        }
    ]
    state = pd.merge_asof(
        dates,
        tpp[keep].sort_values("tpp_source_observation_date"),
        left_on="as_of_date",
        right_on="tpp_source_observation_date",
        direction="backward",
        allow_exact_matches=True,
    )
    state["tpp_available"] = state["tpp_source_observation_date"].notna().astype("int8")
    state["tpp_observed_same_day"] = (
        state["tpp_source_observation_date"].eq(state["as_of_date"])
    ).astype("int8")
    state["tpp_observation_age_calendar_days"] = (
        state["as_of_date"] - state["tpp_source_observation_date"]
    ).dt.days.astype("float64")
    return state[["as_of_date", "tpp_source_observation_date"] + TPP_PREDICTORS]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build source-level strict July-2017 features without legacy feature reuse"
    )
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()

    from fund_ml.data import ProjectPaths, TPP_FULL, rebuild_tpp_rate_features

    paths = ProjectPaths(root)
    config = json.loads(paths.config.read_text(encoding="utf-8"))
    source_start = pd.Timestamp(config.get("strict_source_min_date", DEFAULT_SOURCE_START))
    cutoff = pd.Timestamp(config.get("forecast_origin", DEFAULT_CUTOFF))
    equity_path = root / "data" / "source" / "equity_prices.parquet"
    label_path = root / "data" / "source" / "labels_source_price_return.parquet"
    gap_path = root / "data" / "source" / "gap_resolution_report.csv"
    jump_path = root / "data" / "source" / "equity_price_jump_events.csv"
    required = [equity_path, label_path, paths.tpp_day1, paths.predictors, gap_path, jump_path]
    missing_paths = [str(path) for path in required if not path.is_file()]
    if missing_paths:
        raise FileNotFoundError(missing_paths)

    report_dir = root / "reports" / "strict_source_lock"
    report_dir.mkdir(parents=True, exist_ok=True)
    original_equity_hash = sha256_file(equity_path)
    original_labels_hash = sha256_file(label_path)

    equity = pd.read_parquet(equity_path)
    equity["date"] = pd.to_datetime(equity["date"], errors="raise")
    original_equity_rows = len(equity)
    equity = equity.loc[
        equity["date"].between(source_start, cutoff, inclusive="both")
    ].copy()
    equity.sort_values(["instrument_id", "date"], inplace=True)
    equity.reset_index(drop=True, inplace=True)
    if equity["instrument_id"].nunique() != 58:
        raise RuntimeError("Strict source filter changed the 58-stock universe")
    if equity["date"].min() < source_start or equity["date"].max() > cutoff:
        raise RuntimeError("Strict physical equity source boundary failed")
    equity.to_parquet(equity_path, index=False)

    features = build_equity_features(
        equity_path, gap_path, jump_path, source_start, cutoff
    )
    features, duplicate_audit = rebuild_tpp_rate_features(features, paths.tpp_day1)
    for column in TPP_FULL:
        if column not in features:
            features[column] = np.nan
    contract = json.loads(paths.predictors.read_text(encoding="utf-8"))
    absent = sorted(set(contract["predictors"]).difference(features.columns))
    if absent:
        raise RuntimeError(f"Predictor construction incomplete: {absent}")
    features.sort_values(["instrument_id", "as_of_date"], inplace=True)
    features.reset_index(drop=True, inplace=True)
    if features.duplicated(["instrument_id", "as_of_date"]).any():
        raise RuntimeError("Duplicate strict feature key")
    features.to_parquet(paths.features, index=False)

    labels = pd.read_parquet(label_path)
    labels["as_of_date"] = pd.to_datetime(labels["as_of_date"], errors="raise")
    labels["label_target_date"] = pd.to_datetime(
        labels["label_target_date"], errors="raise"
    )
    original_label_rows = len(labels)
    labels = labels.loc[
        labels["horizon_months"].isin(config["horizons_months"])
        & labels["as_of_date"].between(source_start, cutoff, inclusive="both")
        & labels["label_target_date"].le(pd.Timestamp(config["label_maturity_cutoff"]))
    ].copy()
    labels.sort_values(["horizon_months", "as_of_date", "instrument_id"], inplace=True)
    labels.reset_index(drop=True, inplace=True)
    labels.to_parquet(label_path, index=False)

    duplicate_audit.to_csv(report_dir / "tpp_duplicate_audit.csv", index=False)
    eligible = features["feature_eligible"].astype(bool)
    predictor_missing = (
        features.loc[eligible, contract["predictors"]]
        .isna()
        .sum()
        .rename("missing_cells")
        .reset_index()
        .rename(columns={"index": "predictor"})
    )
    predictor_missing.to_csv(report_dir / "eligible_predictor_missingness.csv", index=False)

    summary = {
        "status": "PASS",
        "strict_source_min_date_requested": str(source_start.date()),
        "physical_equity_min_date": str(features["as_of_date"].min().date()),
        "physical_equity_max_date": str(features["as_of_date"].max().date()),
        "original_equity_rows": int(original_equity_rows),
        "strict_equity_rows": int(len(equity)),
        "removed_equity_rows": int(original_equity_rows - len(equity)),
        "tickers": int(features["instrument_id"].nunique()),
        "strict_feature_rows": int(len(features)),
        "eligible_feature_rows": int(eligible.sum()),
        "first_eligible_origin": str(features.loc[eligible, "as_of_date"].min().date()),
        "last_eligible_origin": str(features.loc[eligible, "as_of_date"].max().date()),
        "original_label_rows": int(original_label_rows),
        "strict_label_rows": int(len(labels)),
        "pre_2017_07_equity_rows_remaining": int(
            features["as_of_date"].lt(source_start).sum()
        ),
        "legacy_feature_file_read": False,
        "equity_predictor_count_recomputed": int(
            len(BASE_EQUITY_PREDICTORS + TECHNICAL_PREDICTORS + UNIVERSE_PREDICTORS)
        ),
        "feature_file_sha256": sha256_file(paths.features),
        "strict_equity_file_sha256": sha256_file(equity_path),
        "strict_label_file_sha256": sha256_file(label_path),
        "input_copy_hashes": {
            "equity_before_strict_filter": original_equity_hash,
            "labels_before_strict_filter": original_labels_hash,
        },
        "feature_warmup_rule": "minimum 253 post-2017-07 observations and all 49 equity predictors finite",
        "economic_adjustment_applied": False,
        "imputation_applied": False,
    }
    (report_dir / "strict_source_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    lines = [
        "# 2017 Temmuz Strict Source Lock",
        "",
        "Sonuç: **PASS**",
        "",
        f"- Talep edilen kaynak alt sınırı: `{source_start.date()}`",
        f"- İlk fiziksel işlem günü: `{features['as_of_date'].min().date()}`",
        f"- Forecast origin: `{cutoff.date()}`",
        f"- Yeniden hesaplanan equity predictor sayısı: `{summary['equity_predictor_count_recomputed']}`",
        f"- Kaldırılan kaynak equity satırı: `{summary['removed_equity_rows']}`",
        f"- İlk feature-eligible origin: `{summary['first_eligible_origin']}`",
        "- Eski `final_features_daily.parquet` okunmadı.",
        "- Rolling, EWM, teknik ve Universe58 leave-one-out değişkenleri filtrelenmiş OHLC'den sıfırdan hesaplandı.",
        "- Fiyat düzeltmesi, rebasing, imputation veya forward-fill uygulanmadı.",
    ]
    (report_dir / "strict_source_report.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
