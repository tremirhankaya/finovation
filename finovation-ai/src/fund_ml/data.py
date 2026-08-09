from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import numpy as np
import pandas as pd


TPP_FULL = [
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

TPP_RATE_ONLY = [
    "tpp_day1_weighted_average",
    "tpp_day1_rate_change_1_observed",
    "tpp_day1_rate_change_5_observed",
    "tpp_day1_rate_change_20_observed",
    "tpp_day1_rate_change_volatility_20",
    "tpp_day1_rate_vs_ma20",
    "tpp_observation_age_calendar_days",
    "tpp_available",
    "tpp_observed_same_day",
    "tpp_source_zero_weighted_average",
]


@dataclass(frozen=True)
class ProjectPaths:
    root: Path

    @property
    def config(self) -> Path:
        return self.root / "configs" / "project.json"

    @property
    def predictors(self) -> Path:
        return self.root / "data" / "source" / "predictors.json"

    @property
    def features(self) -> Path:
        return self.root / "data" / "source" / "final_features_daily.parquet"

    @property
    def labels(self) -> Path:
        return self.root / "data" / "source" / "labels_source_price_return.parquet"

    @property
    def tpp_day1(self) -> Path:
        return self.root / "data" / "source" / "tpp_day1.csv"


@dataclass
class Fold:
    fold_id: str
    train: pd.DataFrame
    valid: pd.DataFrame


def load_config(paths: ProjectPaths) -> dict:
    return json.loads(paths.config.read_text(encoding="utf-8"))


def load_predictor_contract(paths: ProjectPaths) -> dict:
    return json.loads(paths.predictors.read_text(encoding="utf-8"))


def predictors_for_feature_set(contract: dict, feature_set: str) -> list[str]:
    predictors = list(contract["predictors"])
    if feature_set == "EQUITY_ONLY":
        return [name for name in predictors if name not in TPP_FULL]
    if feature_set == "FULL_DAY1":
        return predictors
    if feature_set == "RATE_ONLY":
        return [name for name in predictors if name not in TPP_FULL or name in TPP_RATE_ONLY]
    raise ValueError(f"Unknown feature set: {feature_set}")


def rebuild_tpp_rate_features(
    features: pd.DataFrame, source_path: Path
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Rebuild allowed day-1 rate features from the approved source CSV.

    A zero-volume/zero-transaction carry row is not a new rate observation.
    Exact economic duplicates are reported and the earliest publication is used.
    """
    source = pd.read_csv(source_path)
    required = {
        "issue_date",
        "data_date",
        "day",
        "trading_volume_TR",
        "transaction_count",
        "weighted_average",
    }
    missing = sorted(required.difference(source.columns))
    if missing:
        raise RuntimeError(f"TPP source is missing columns: {missing}")
    if not source["day"].eq(1).all():
        raise RuntimeError("TPP source contains tenor other than day=1")
    for column in ("issue_date", "data_date"):
        source[column] = pd.to_datetime(source[column], errors="raise")

    duplicate_audit = source.loc[
        source.duplicated("data_date", keep=False)
    ].sort_values(["data_date", "issue_date"]).copy()
    economic_columns = [
        column
        for column in (
            "weighted_average",
            "close_rate",
            "open_rate",
            "high_rate",
            "low_rate",
            "trading_volume_TR",
            "transaction_count",
        )
        if column in source.columns
    ]
    for data_date, part in duplicate_audit.groupby("data_date"):
        if len(part[economic_columns].drop_duplicates()) != 1:
            raise RuntimeError(f"Conflicting TPP duplicate at {data_date.date()}")

    observed = source.loc[
        source["trading_volume_TR"].gt(0)
        & source["transaction_count"].gt(0)
        & source["weighted_average"].gt(0)
    ].copy()
    observed.sort_values(["data_date", "issue_date"], inplace=True)
    observed = observed.drop_duplicates("data_date", keep="first")
    observed.sort_values(["issue_date", "data_date"], inplace=True)
    observed = observed.groupby("issue_date", as_index=False).tail(1).copy()
    observed.sort_values("issue_date", inplace=True)

    rate = observed["weighted_average"].astype(float)
    observed["tpp_day1_weighted_average"] = rate
    for lag in (1, 5, 20):
        observed[f"tpp_day1_rate_change_{lag}_observed"] = rate.diff(lag)
    observed["tpp_day1_rate_change_volatility_20"] = rate.diff().rolling(
        20, min_periods=10
    ).std(ddof=1)
    observed["tpp_day1_rate_vs_ma20"] = rate - rate.rolling(
        20, min_periods=10
    ).mean()
    observed["tpp_source_zero_weighted_average"] = 0.0

    calendar = pd.DataFrame(
        {"as_of_date": pd.to_datetime(features["as_of_date"].drop_duplicates())}
    ).sort_values("as_of_date")
    allowed = [
        "issue_date",
        "data_date",
        "tpp_day1_weighted_average",
        "tpp_day1_rate_change_1_observed",
        "tpp_day1_rate_change_5_observed",
        "tpp_day1_rate_change_20_observed",
        "tpp_day1_rate_change_volatility_20",
        "tpp_day1_rate_vs_ma20",
        "tpp_source_zero_weighted_average",
    ]
    mapped = pd.merge_asof(
        calendar,
        observed[allowed].sort_values("issue_date"),
        left_on="as_of_date",
        right_on="issue_date",
        direction="backward",
        allow_exact_matches=True,
    )
    mapped["tpp_available"] = mapped["issue_date"].notna().astype("int8")
    mapped["tpp_observed_same_day"] = (
        mapped["issue_date"].dt.normalize().eq(mapped["as_of_date"].dt.normalize())
    ).astype("int8")
    mapped["tpp_observation_age_calendar_days"] = (
        mapped["as_of_date"] - mapped["data_date"]
    ).dt.days.astype(float)
    mapped.drop(columns=["issue_date", "data_date"], inplace=True)

    output = features.drop(columns=[c for c in TPP_RATE_ONLY if c in features], errors="ignore")
    output = output.merge(mapped, on="as_of_date", how="left", validate="many_to_one")
    return output, duplicate_audit


def load_inputs(paths: ProjectPaths) -> tuple[pd.DataFrame, pd.DataFrame, dict, dict]:
    config = load_config(paths)
    contract = load_predictor_contract(paths)
    all_predictors = list(contract["predictors"])
    feature_columns = [
        "instrument_id",
        "as_of_date",
        "market_data_through_date",
        "feature_available_from",
        "feature_eligible",
    ] + all_predictors
    features = pd.read_parquet(paths.features, columns=feature_columns)
    labels = pd.read_parquet(paths.labels)
    for frame in (features, labels):
        frame["as_of_date"] = pd.to_datetime(frame["as_of_date"])
    features["feature_available_from"] = pd.to_datetime(features["feature_available_from"])
    labels["label_target_date"] = pd.to_datetime(labels["label_target_date"])
    features, _ = rebuild_tpp_rate_features(features, paths.tpp_day1)
    return features, labels, config, contract


def _weekly_origin_dates(frame: pd.DataFrame) -> pd.Index:
    dates = pd.Series(pd.to_datetime(frame["as_of_date"].drop_duplicates())).sort_values()
    iso = dates.dt.isocalendar()
    week_table = pd.DataFrame(
        {
            "as_of_date": dates.to_numpy(),
            "iso_year": iso["year"].to_numpy(),
            "iso_week": iso["week"].to_numpy(),
        }
    )
    return pd.Index(week_table.groupby(["iso_year", "iso_week"])["as_of_date"].max())


def build_horizon_table(
    features: pd.DataFrame,
    labels: pd.DataFrame,
    config: dict,
    horizon: int,
) -> pd.DataFrame:
    start = pd.Timestamp(config["training_start_date"])
    cutoff = pd.Timestamp(config["label_maturity_cutoff"])
    selected_labels = labels.loc[
        labels["horizon_months"].eq(horizon)
        & labels["as_of_date"].ge(start)
        & labels["label_target_date"].le(cutoff)
        & labels["label_eligible"].astype(bool),
        [
            "instrument_id",
            "as_of_date",
            "horizon_months",
            "label_target_date",
            "absolute_source_log_return",
            "absolute_source_price_return",
        ],
    ].copy()
    eligible_features = features.loc[features["feature_eligible"].astype(bool)].copy()
    table = selected_labels.merge(
        eligible_features,
        on=["instrument_id", "as_of_date"],
        how="inner",
        validate="one_to_one",
    )
    weekly_dates = _weekly_origin_dates(table)
    table = table.loc[table["as_of_date"].isin(weekly_dates)].copy()
    counts = table.groupby("as_of_date")["instrument_id"].nunique()
    valid_dates = counts.loc[counts.ge(int(config["minimum_names_per_origin"]))].index
    table = table.loc[table["as_of_date"].isin(valid_dates)].copy()
    table.sort_values(["as_of_date", "instrument_id"], inplace=True)
    table.reset_index(drop=True, inplace=True)
    if table.empty:
        raise RuntimeError(f"No eligible weekly rows for {horizon}M")
    if table["label_target_date"].gt(cutoff).any():
        raise RuntimeError("Future label entered model table")
    if table["as_of_date"].lt(start).any():
        raise RuntimeError(
            f"Origin before configured training start entered model table: {start.date()}"
        )
    if table["label_target_date"].le(table["as_of_date"]).any():
        raise RuntimeError("Non-forward label entered model table")
    market_through = pd.to_datetime(table["market_data_through_date"])
    if market_through.gt(table["as_of_date"]).any():
        raise RuntimeError("Future market data entered model table")
    return table


def development_folds(table: pd.DataFrame, config: dict) -> Iterator[Fold]:
    for window in config["development_windows"]:
        valid_start = pd.Timestamp(window["start"])
        valid_end = pd.Timestamp(window["end"])
        train = table.loc[
            table["as_of_date"].lt(valid_start)
            & table["label_target_date"].lt(valid_start)
        ].copy()
        valid = table.loc[
            table["as_of_date"].ge(valid_start) & table["as_of_date"].le(valid_end)
        ].copy()
        if train.empty or valid.empty:
            continue
        if train["label_target_date"].max() >= valid["as_of_date"].min():
            raise RuntimeError(f"Purging failed for {window['fold_id']}")
        yield Fold(str(window["fold_id"]), train, valid)


def fixed_test_fold(table: pd.DataFrame, config: dict) -> Fold:
    window = config["sealed_holdout"]
    valid_start = pd.Timestamp(window["start"])
    valid_end = pd.Timestamp(window["end"])
    train = table.loc[
        table["as_of_date"].lt(valid_start)
        & table["label_target_date"].lt(valid_start)
    ].copy()
    valid = table.loc[
        table["as_of_date"].ge(valid_start) & table["as_of_date"].le(valid_end)
    ].copy()
    if train.empty or valid.empty:
        raise RuntimeError("Sealed common holdout is empty")
    if train["label_target_date"].max() >= valid["as_of_date"].min():
        raise RuntimeError("Fixed-test purging failed")
    return Fold(str(window["fold_id"]), train, valid)


def add_relevance_labels(frame: pd.DataFrame, buckets: int = 10) -> pd.DataFrame:
    output = frame.copy()
    pct = output.groupby("as_of_date")["absolute_source_log_return"].rank(
        method="average", pct=True
    )
    output["relevance"] = np.minimum(
        buckets - 1, np.floor(np.maximum(0.0, pct - np.finfo(float).eps) * buckets)
    ).astype("int32")
    return output


def inference_rows(
    features: pd.DataFrame, config: dict, origin: str | None = None
) -> pd.DataFrame:
    selected_origin = pd.Timestamp(origin or config["forecast_origin"])
    rows = features.loc[features["as_of_date"].eq(selected_origin)].copy()
    if len(rows) != 58 or rows["instrument_id"].nunique() != 58:
        raise RuntimeError(f"Expected 58 inference rows at {selected_origin.date()}")
    if not rows["feature_eligible"].astype(bool).all():
        raise RuntimeError("Feature-ineligible inference row")
    system_date = pd.Timestamp(config["system_date"])
    available = pd.to_datetime(rows["feature_available_from"], utc=True).dt.tz_convert(None)
    if available.dt.date.max() > system_date.date():
        raise RuntimeError("Inference feature is not available by system date")
    return rows.sort_values("instrument_id").reset_index(drop=True)
