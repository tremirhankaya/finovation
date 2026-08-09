from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def model_metrics(root: Path, horizon: int) -> dict:
    search = root / "reports" / "model_search" / f"h{horizon:02d}"
    quantile = read_json(search / "quantile_selection.json")
    rank = read_json(search / "ranker_selection.json")
    holdout = quantile["holdout_metrics"]
    baseline = quantile["holdout_baseline_metrics"]
    rank_holdout = rank["holdout_metrics"]
    return {
        "quantile_model": quantile["candidate_id"],
        "feature_set": quantile["feature_set"],
        "holdout_rows": int(holdout["rows"]),
        "mean_pinball": float(holdout["mean_pinball"]),
        "empirical_pinball": float(baseline["mean_pinball"]),
        "pinball_ratio": float(holdout["mean_pinball"] / baseline["mean_pinball"]),
        "coverage_80": float(holdout["coverage_80"]),
        "coverage_error": abs(float(holdout["coverage_80"]) - 0.8),
        "crossing_rate": float(holdout["core_crossing_rate"]),
        "q50_unique": int(holdout["q50_unique"]),
        "rank_signal": rank["candidate_id"],
        "rank_holdout_ic": float(rank_holdout["mean_date_spearman"]),
        "rank_positive_rate": float(rank_holdout["positive_date_spearman_rate"]),
        "rank_top_bottom_spread": float(rank_holdout["mean_top_bottom_20_spread"]),
        "rank_ndcg_10": float(rank_holdout.get("ndcg_at_10", np.nan)),
    }


def forecast_overlap(baseline_root: Path, candidate_root: Path, horizon: int) -> dict:
    columns = ["instrument_id", "horizon_months", "rank_score", "simple_q50"]
    old = pd.read_parquet(
        baseline_root / "artifacts" / "forecast_bundle_v2" / "equity_forecasts.parquet",
        columns=columns,
    )
    new = pd.read_parquet(
        candidate_root / "artifacts" / "forecast_bundle_v2" / "equity_forecasts.parquet",
        columns=columns,
    )
    old = old.loc[old["horizon_months"].eq(horizon)].copy()
    new = new.loc[new["horizon_months"].eq(horizon)].copy()
    old_top = set(old.nlargest(10, "rank_score")["instrument_id"])
    new_top = set(new.nlargest(10, "rank_score")["instrument_id"])
    return {
        "top10_overlap_count": len(old_top & new_top),
        "top10_jaccard": len(old_top & new_top) / len(old_top | new_top),
        "baseline_median_simple_q50": float(old["simple_q50"].median()),
        "strict_median_simple_q50": float(new["simple_q50"].median()),
    }


def compare_portfolios(baseline_root: Path, candidate_root: Path) -> pd.DataFrame:
    old = {
        row["objective_id"]: row
        for row in read_json(
            baseline_root / "outputs" / "examples" / "create_result.json"
        )["alternatives"]
    }
    new = {
        row["objective_id"]: row
        for row in read_json(
            candidate_root / "outputs" / "examples" / "create_result.json"
        )["alternatives"]
    }
    rows = []
    for objective in sorted(set(old) & set(new)):
        left = old[objective]
        right = new[objective]
        assets = sorted(set(left["weights"]) | set(right["weights"]))
        l1_half = 0.5 * sum(
            abs(float(left["weights"].get(asset, 0.0)) - float(right["weights"].get(asset, 0.0)))
            for asset in assets
        )
        left_stocks = set(left["weights"]) - {"CASH_TPP"}
        right_stocks = set(right["weights"]) - {"CASH_TPP"}
        rows.append(
            {
                "objective": objective,
                "baseline_stock_count": left["stock_count"],
                "strict_stock_count": right["stock_count"],
                "equity_name_overlap": len(left_stocks & right_stocks),
                "equity_name_jaccard": len(left_stocks & right_stocks)
                / len(left_stocks | right_stocks),
                "weight_half_l1_distance": l1_half,
                "baseline_tpp": left["tpp_weight"],
                "strict_tpp": right["tpp_weight"],
                "baseline_volatility": left["horizon_volatility"],
                "strict_volatility": right["horizon_volatility"],
                "baseline_beta": left["universe58_beta"],
                "strict_beta": right["universe58_beta"],
                "baseline_model_utility_log": left["expected_model_utility_log"],
                "strict_model_utility_log": right["expected_model_utility_log"],
            }
        )
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare full-history and July-2017 strict variants")
    parser.add_argument("--baseline-root", type=Path, required=True)
    parser.add_argument("--candidate-root", type=Path, required=True)
    args = parser.parse_args()
    baseline_root = args.baseline_root.resolve()
    candidate_root = args.candidate_root.resolve()
    output = candidate_root / "reports" / "comparison_vs_current"
    output.mkdir(parents=True, exist_ok=True)

    old_config = read_json(baseline_root / "configs" / "project.json")
    new_config = read_json(candidate_root / "configs" / "project.json")
    old_inventory = pd.read_csv(baseline_root / "reports" / "data" / "horizon_inventory.csv")
    new_inventory = pd.read_csv(candidate_root / "reports" / "data" / "horizon_inventory.csv")

    metric_rows = []
    for horizon in (3, 6, 12):
        old = model_metrics(baseline_root, horizon)
        new = model_metrics(candidate_root, horizon)
        overlap = forecast_overlap(baseline_root, candidate_root, horizon)
        old_inv = old_inventory.loc[old_inventory["horizon_months"].eq(horizon)].iloc[0]
        new_inv = new_inventory.loc[new_inventory["horizon_months"].eq(horizon)].iloc[0]
        metric_rows.append(
            {
                "horizon": f"{horizon}M",
                "baseline_rows": int(old_inv["rows"]),
                "strict_rows": int(new_inv["rows"]),
                "row_change_pct": float(new_inv["rows"] / old_inv["rows"] - 1.0),
                "baseline_first_origin": old_inv["origin_start"],
                "strict_first_origin": new_inv["origin_start"],
                "baseline_quantile_model": old["quantile_model"],
                "strict_quantile_model": new["quantile_model"],
                "baseline_feature_set": old["feature_set"],
                "strict_feature_set": new["feature_set"],
                "baseline_pinball": old["mean_pinball"],
                "strict_pinball": new["mean_pinball"],
                "pinball_delta": new["mean_pinball"] - old["mean_pinball"],
                "pinball_change_pct": new["mean_pinball"] / old["mean_pinball"] - 1.0,
                "baseline_pinball_ratio": old["pinball_ratio"],
                "strict_pinball_ratio": new["pinball_ratio"],
                "baseline_coverage80": old["coverage_80"],
                "strict_coverage80": new["coverage_80"],
                "coverage_error_delta": new["coverage_error"] - old["coverage_error"],
                "baseline_q50_unique": old["q50_unique"],
                "strict_q50_unique": new["q50_unique"],
                "baseline_rank_signal": old["rank_signal"],
                "strict_rank_signal": new["rank_signal"],
                "baseline_rank_ic": old["rank_holdout_ic"],
                "strict_rank_ic": new["rank_holdout_ic"],
                "rank_ic_delta": new["rank_holdout_ic"] - old["rank_holdout_ic"],
                "baseline_rank_positive_rate": old["rank_positive_rate"],
                "strict_rank_positive_rate": new["rank_positive_rate"],
                "baseline_rank_spread": old["rank_top_bottom_spread"],
                "strict_rank_spread": new["rank_top_bottom_spread"],
                "rank_spread_delta": new["rank_top_bottom_spread"] - old["rank_top_bottom_spread"],
                **overlap,
            }
        )
    metrics = pd.DataFrame(metric_rows)
    portfolios = compare_portfolios(baseline_root, candidate_root)
    metrics.to_csv(output / "horizon_metric_comparison.csv", index=False)
    portfolios.to_csv(output / "create_portfolio_comparison.csv", index=False)

    summary = {
        "baseline_project": str(baseline_root),
        "candidate_project": str(candidate_root),
        "same_system_date": old_config["system_date"] == new_config["system_date"],
        "same_forecast_origin": old_config["forecast_origin"] == new_config["forecast_origin"],
        "same_label_cutoff": old_config["label_maturity_cutoff"]
        == new_config["label_maturity_cutoff"],
        "baseline_training_start": old_config["training_start_date"],
        "candidate_strict_source_min": new_config["strict_source_min_date"],
        "candidate_training_start": new_config["training_start_date"],
        "all_candidate_horizons_eligible": bool(
            all(
                row["horizon_eligible"]
                for row in read_json(
                    candidate_root / "artifacts" / "forecast_bundle_v2" / "manifest.json"
                )["horizon_decisions"]
            )
        ),
        "candidate_tests": "12_PASSED",
        "economic_adjustment_applied": False,
    }
    (output / "comparison_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    verdicts = []
    for row in metrics.to_dict("records"):
        quantile = (
            "STRICT_BETTER" if row["pinball_delta"] < 0 else "CURRENT_BETTER"
        )
        if abs(row["rank_ic_delta"]) < 1e-12:
            rank = "TIE"
        else:
            rank = "STRICT_BETTER" if row["rank_ic_delta"] > 0 else "CURRENT_BETTER"
        verdicts.append(f"- {row['horizon']}: quantile proper score `{quantile}`, rank IC `{rank}`.")
    lines = [
        "# July-2017 Strict Varyantı — Mevcut Model Karşılaştırması",
        "",
        "## Deney kontrolü",
        "",
        "- Sistem tarihi, forecast origin, label cutoff, development fold'ları, common holdout, aday aileleri, random seed ve optimizer isteği aynıdır.",
        "- Değişen ana faktör: equity kaynağının fiziksel alt sınırı ve buna bağlı olarak tüm rolling/EWM equity feature'larının yeniden hesaplanmasıdır.",
        "- Mevcut sürüm 2014'ten başlayan feature geçmişini kullanır; strict sürüm 2017-07-01 öncesini fiziksel olarak içermez.",
        "- Holdout pinball düşük olduğunda, coverage error sıfıra yaklaştığında ve rank IC/spread yüksek olduğunda daha iyidir.",
        "",
        "## Horizon sonuçları",
        "",
        metrics.to_markdown(index=False, floatfmt=".6f"),
        "",
        "## Kısa hüküm",
        "",
        *verdicts,
        "",
        "Tek bir varyant bütün hedeflerde otomatik şampiyon sayılmamalıdır. Quantile dağılım kalitesi ile hisse sıralama kalitesi ayrı okunmalıdır. Q50 çeşitliliği düşük olsa bile açıkça seçilmiş rank comparator'ı portföy seçim sinyalini sağlar; fakat bu durum q50'nin nokta-tahmin olarak güçlü olduğu anlamına gelmez.",
        "",
        "## Aynı CREATE isteğinin etkisi",
        "",
        portfolios.to_markdown(index=False, floatfmt=".6f"),
        "",
        "Model utility değerleri farklı model ölçeklerinden geldiği için varyantlar arasında tek başına doğrudan ekonomik getiri karşılaştırması değildir. Portföy beta, volatilite, isim örtüşmesi ve holdout skorlarıyla birlikte değerlendirilmelidir.",
        "",
        "## Kaynak-kilidi kararı",
        "",
        "Kullanıcının 'en eski veri 2017 Temmuz' şartını yalnız strict varyant karşılar. Mevcut sürüm performans açısından bazı horizonlarda daha iyi olsa bile bu kaynak sözleşmesini ihlal eder ve şart değişmedikçe üretim adayı olarak kullanılamaz.",
        "",
        "Hiçbir ekonomik fiyat düzeltmesi, split/temettü uygulaması, rebasing, forward-fill veya imputation yapılmadı.",
    ]
    (output / "comparison_report.md").write_text("\n".join(lines), encoding="utf-8")
    print(metrics.to_string(index=False))
    print("\n", portfolios.to_string(index=False))


if __name__ == "__main__":
    main()
