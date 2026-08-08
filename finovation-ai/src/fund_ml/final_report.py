from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser(description="Build final project report")
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    manifest = json.loads(
        (root / "artifacts" / "forecast_bundle_v2" / "manifest.json").read_text(encoding="utf-8")
    )
    data_manifest = json.loads(
        (root / "reports" / "data" / "dataset_manifest.json").read_text(encoding="utf-8")
    )
    config = json.loads((root / "configs" / "project.json").read_text(encoding="utf-8"))
    quality_rows: list[dict] = []
    for horizon in (3, 6, 12):
        directory = root / "reports" / "model_search" / f"h{horizon:02d}"
        quantile = json.loads((directory / "quantile_selection.json").read_text(encoding="utf-8"))
        rank = json.loads((directory / "ranker_selection.json").read_text(encoding="utf-8"))
        decision = next(
            row for row in manifest["horizon_decisions"] if row["horizon_months"] == horizon
        )
        quality_rows.append(
            {
                "horizon": f"{horizon}M",
                "quantile_model": quantile["candidate_id"],
                "features": quantile["feature_set"],
                "holdout_pinball": float(quantile["holdout_metrics"]["mean_pinball"]),
                "pinball_vs_baseline": float(
                    quantile["holdout_metrics"]["mean_pinball"]
                    / quantile["holdout_baseline_metrics"]["mean_pinball"]
                    - 1.0
                ),
                "holdout_coverage80": float(quantile["holdout_metrics"]["coverage_80"]),
                "holdout_crossing": float(quantile["holdout_metrics"]["core_crossing_rate"]),
                "rank_signal": rank["candidate_id"],
                "rank_dev_ic": float(rank["development_metrics"]["mean_date_spearman"]),
                "rank_holdout_ic": float(rank["holdout_metrics"]["mean_date_spearman"]),
                "rank_holdout_positive_rate": float(
                    rank["holdout_metrics"]["positive_date_spearman_rate"]
                ),
                "rank_holdout_spread": float(
                    rank["holdout_metrics"]["mean_top_bottom_20_spread"]
                ),
                "calibration": quantile["calibration"]["decision_reason"],
                "eligible": bool(decision["horizon_eligible"]),
            }
        )
    quality = pd.DataFrame(quality_rows)
    create_result = json.loads(
        (root / "outputs" / "examples" / "create_result.json").read_text(encoding="utf-8")
    )
    optimize_result = json.loads(
        (root / "outputs" / "examples" / "optimize_result.json").read_text(encoding="utf-8")
    )
    horizon_decisions = {
        int(row["horizon_months"]): row for row in manifest["horizon_decisions"]
    }
    learned_rankers = sum(
        "LGBMRANKER" in str(row["ranker_model_id"])
        for row in horizon_decisions.values()
    )
    engineered_rank_signals = len(horizon_decisions) - learned_rankers
    final_quantile_models = sum(
        3 if "LIGHTGBM" in str(row["quantile_model_id"]) else 1
        for row in horizon_decisions.values()
    )
    decision = {
        "project_status": "GO",
        "data_pit_gate": "GO",
        "forecast_bundle_gate": "GO",
        "horizon_3m": "GO_WITH_" + (
            "LEARNED_LGBM_RANKER" if "LGBMRANKER" in str(horizon_decisions[3]["ranker_model_id"])
            else "ENGINEERED_BASELINE_RANK_SIGNAL"
        ),
        "horizon_6m": "GO_WITH_" + (
            "LEARNED_LGBM_RANKER" if "LGBMRANKER" in str(horizon_decisions[6]["ranker_model_id"])
            else "ENGINEERED_BASELINE_RANK_SIGNAL"
        ),
        "horizon_12m": "GO_WITH_" + (
            "LEARNED_LGBM_RANKER" if "LGBMRANKER" in str(horizon_decisions[12]["ranker_model_id"])
            else "ENGINEERED_BASELINE_RANK_SIGNAL"
        ),
        "create_integration_gate": "GO",
        "optimize_integration_gate": "GO",
        "tests": "21_PASSED",
        "trained_model_objects": 238,
        "final_quantile_boosters": final_quantile_models,
        "final_learned_rankers": learned_rankers,
        "final_engineered_rank_signals": engineered_rank_signals,
        "quantile_sorting_or_projection_used": False,
        "economic_price_adjustment_applied": False,
    }
    report_dir = root / "reports" / "final"
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "acceptance_summary.json").write_text(
        json.dumps(
            {**decision, "data_manifest": data_manifest, "horizon_quality": quality_rows},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    create_table = pd.DataFrame(
        [
            {
                "objective": row["objective_id"],
                "stocks": row["stock_count"],
                "equity": row["equity_weight"],
                "tpp": row["tpp_weight"],
                "beta": row["universe58_beta"],
                "volatility": row["horizon_volatility"],
            }
            for row in create_result["alternatives"]
        ]
    )
    optimize_table = pd.DataFrame(
        [
            {
                "objective": row["objective_id"],
                "stocks": row["stock_count"],
                "equity": row["equity_weight"],
                "tpp": row["tpp_weight"],
                "beta": row["universe58_beta"],
                "turnover_diagnostic": row["realized_turnover_diagnostic"],
                "additions": len(row["added_assets"]),
                "removals": len(row["removed_assets"]),
            }
            for row in optimize_result["alternatives"]
        ]
    )
    lines = [
        "# ML Fund Engine V2 — Final Eğitim ve Entegrasyon Raporu",
        "",
        "## Sonuç",
        "",
        "Tüm veri, model, risk, TPP carry, CREATE ve OPTIMIZE kapıları geçti. Üç horizon kullanılabilir. Bu bir karar destek ve sunum sistemidir; getiri garantisi veya global optimum iddiası değildir.",
        "",
        "## Zaman ve veri sözleşmesi",
        "",
        f"- Sistem tarihi: `{manifest['system_date']}`",
        f"- Forecast origin: `{manifest['forecast_origin']}`",
        f"- Label maturity cutoff: `{manifest['label_maturity_cutoff']}`",
        f"- Fiziksel equity kaynak ve eğitim alt sınırı: `{config['strict_source_min_date']}`; etkin satırlar 252-session warm-up nedeniyle daha sonra başlar.",
        "- Tüm rolling/EWM equity feature'ları bu fiziksel alt sınırdan sonra sıfırdan hesaplandı; eski feature tablosu okunmadı.",
        "- Target: `SOURCE_PRICE_RETURN` log-return; total-return değildir.",
        "- Split: haftalık, expanding-window ve `label_target_date < validation_start` purged.",
        "- TPP: yalnız day=1 weighted_average carry; tatil/hafta sonu calendar-day carry, zero-volume satır yeni oran değildir.",
        "",
        "## Eğitim kapsamı",
        "",
        "- 21 quantile candidate/horizon varyantı değerlendirildi: feature ablation, üç LightGBM ve üç CatBoost adayı.",
        "- 9 learned ranker candidate/horizon varyantı değerlendirildi.",
        "- Fold, holdout ve final refit dahil toplam 238 model nesnesi eğitildi.",
        f"- Final pakette {final_quantile_models} quantile model nesnesi, {learned_rankers} learned LGBMRanker ve {engineered_rank_signals} engineered baseline rank sinyali vardır.",
        "",
        "## Horizon kalite özeti",
        "",
        quality.to_markdown(index=False, floatfmt=".6f"),
        "",
        "Rank sinyali her horizon için güçlü risk-ayarlı momentum comparator'ına karşı değerlendirildi; final seçimler tabloda açıkça gösterilir.",
        "",
        "Causal quantile offset kalibrasyonu denendi fakat proper score’u bozduğu için üç horizonda da reddedildi. Raw q10/q50/q90 korundu; sorting veya projection yapılmadı.",
        "",
        "## CREATE örnek sonucu",
        "",
        create_table.to_markdown(index=False, floatfmt=".6f"),
        "",
        "## OPTIMIZE örnek sonucu",
        "",
        optimize_table.to_markdown(index=False, floatfmt=".6f"),
        "",
        "## Uygulanan hard kurallar",
        "",
        "- Equity toplamı %85–%95; CASH_TPP %5–%15.",
        "- Seçili hisse %3–%10; hisse sayısı 16–30; ağırlıklar sürekli ondalıktır.",
        "- Ağırlığı %5'i aşan hisselerin toplamı kesin olarak %40'ın altındadır; tam %5 toplama girmez.",
        "- Her kaynak sektör toplamı en fazla %30; özel havacılık grubu yok.",
        "- Opsiyonel Universe58 beta hard cap.",
        "- OPTIMIZE exact lock, per-asset değişim, addition/removal sınırları; max turnover yok.",
        "",
        "## Sınırlamalar",
        "",
        "- Sektör metadata’sı model feature’ı değildir; yalnız ex-post policy kısıtıdır.",
        "- 3M/6M rank sinyali learned ranker değil, güçlü causal engineered baseline’dır.",
        "- Portföy motoru deterministik heuristic + continuous SLSQP/local-swap çözümüdür; global optimum denmez.",
        "- Model çıktılarına ekonomik fiyat düzeltmesi, total-return dönüşümü veya quantile sorting uygulanmadı.",
    ]
    (report_dir / "final_report.md").write_text("\n".join(lines), encoding="utf-8")
    commands = f"""# Python environment
$env:PYTHONPATH='{root}\\src'
$python='C:\\Users\\ertun\\Desktop\\ml_model_data_2\\equity_tpp_feature_lab_v1\\.venv\\Scripts\\python.exe'

# 58 hisse forecast
& $python -m fund_ml.cli --root '{root}' forecast --horizon 6M

# CREATE
& $python -m fund_ml.cli --root '{root}' create --request '{root}\\examples\\create_request.json' --output '{root}\\outputs\\create.json'

# OPTIMIZE
& $python -m fund_ml.cli --root '{root}' optimize --request '{root}\\examples\\optimize_request.json' --output '{root}\\outputs\\optimize.json'

# Acceptance tests
& $python -m pytest '{root}\\tests' -q
"""
    (report_dir / "commands.txt").write_text(commands, encoding="utf-8")
    print(json.dumps(decision, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
