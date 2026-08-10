from __future__ import annotations

import math

import numpy as np
import pandas as pd


def pinball(y: np.ndarray, prediction: np.ndarray, quantile: float) -> float:
    residual = np.asarray(y, dtype=float) - np.asarray(prediction, dtype=float)
    return float(np.mean(np.maximum(quantile * residual, (quantile - 1.0) * residual)))


def date_rank_metrics(
    frame: pd.DataFrame,
    score_column: str,
    target_column: str = "absolute_source_log_return",
) -> dict[str, float | int]:
    correlations: list[float] = []
    spreads: list[float] = []
    for _, part in frame.groupby("as_of_date", sort=True):
        if len(part) < 10 or part[score_column].nunique() < 2:
            continue
        correlation = part[score_column].corr(part[target_column], method="spearman")
        if pd.notna(correlation):
            correlations.append(float(correlation))
        count = max(1, int(math.ceil(len(part) * 0.20)))
        ordered = part.sort_values(score_column)
        spread = (
            ordered.tail(count)[target_column].mean()
            - ordered.head(count)[target_column].mean()
        )
        spreads.append(float(spread))
    if not correlations:
        return {
            "rank_dates": 0,
            "mean_date_spearman": float("nan"),
            "median_date_spearman": float("nan"),
            "positive_date_spearman_rate": float("nan"),
            "mean_top_bottom_20_spread": float("nan"),
        }
    return {
        "rank_dates": len(correlations),
        "mean_date_spearman": float(np.mean(correlations)),
        "median_date_spearman": float(np.median(correlations)),
        "positive_date_spearman_rate": float(np.mean(np.asarray(correlations) > 0.0)),
        "mean_top_bottom_20_spread": float(np.mean(spreads)),
    }


def ndcg_at_k(
    frame: pd.DataFrame,
    score_column: str,
    target_column: str = "relevance",
    k: int = 10,
) -> float:
    values: list[float] = []
    for _, part in frame.groupby("as_of_date", sort=True):
        if len(part) < k or part[score_column].nunique() < 2:
            continue
        ordered = part.sort_values(score_column, ascending=False).head(k)
        gains = np.power(2.0, ordered[target_column].to_numpy(dtype=float)) - 1.0
        discount = np.log2(np.arange(2, len(gains) + 2, dtype=float))
        dcg = float(np.sum(gains / discount))
        ideal = part.sort_values(target_column, ascending=False).head(k)
        ideal_gains = np.power(2.0, ideal[target_column].to_numpy(dtype=float)) - 1.0
        idcg = float(np.sum(ideal_gains / discount))
        if idcg > 0:
            values.append(dcg / idcg)
    return float(np.mean(values)) if values else float("nan")


def quantile_metrics(frame: pd.DataFrame) -> dict[str, float | int]:
    y = frame["absolute_source_log_return"].to_numpy(dtype=float)
    q10 = frame["prediction_log_q10"].to_numpy(dtype=float)
    q50 = frame["prediction_log_q50"].to_numpy(dtype=float)
    q90 = frame["prediction_log_q90"].to_numpy(dtype=float)
    crossing = (q10 > q50) | (q50 > q90)
    coverage80 = np.mean((y >= q10) & (y <= q90))
    result: dict[str, float | int] = {
        "rows": len(frame),
        "mean_pinball": float(
            np.mean([pinball(y, q10, 0.10), pinball(y, q50, 0.50), pinball(y, q90, 0.90)])
        ),
        "pinball_q10": pinball(y, q10, 0.10),
        "pinball_q50": pinball(y, q50, 0.50),
        "pinball_q90": pinball(y, q90, 0.90),
        "coverage_80": float(coverage80),
        "coverage_80_error": float(abs(coverage80 - 0.80)),
        "core_crossing_rows": int(crossing.sum()),
        "core_crossing_rate": float(crossing.mean()),
        "q50_unique": int(pd.Series(q50).nunique()),
        "median_q50_unique_per_origin": float(
            frame.assign(_q50=q50).groupby("as_of_date")["_q50"].nunique().median()
        ),
        "origins_q50_unique_ge_10_rate": float(
            frame.assign(_q50=q50)
            .groupby("as_of_date")["_q50"]
            .nunique()
            .ge(10)
            .mean()
        ),
    }
    result.update(date_rank_metrics(frame, "prediction_log_q50"))
    return result


def constant_quantile_predictions(train: pd.DataFrame, valid: pd.DataFrame) -> pd.DataFrame:
    output = valid[
        [
            "instrument_id",
            "as_of_date",
            "horizon_months",
            "label_target_date",
            "absolute_source_log_return",
            "absolute_source_price_return",
        ]
    ].copy()
    target = train["absolute_source_log_return"].to_numpy(dtype=float)
    for quantile in (0.10, 0.50, 0.90):
        output[f"prediction_log_q{int(quantile * 100):02d}"] = float(
            np.quantile(target, quantile)
        )
    return output
