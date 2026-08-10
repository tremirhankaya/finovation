from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from stable_baselines3 import PPO


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def audit(root: Path | None = None) -> dict:
    root = (root or Path.cwd()).resolve()
    artifacts = root / "artifacts_v22"
    pipeline = artifacts / "pipeline"
    delivery = artifacts / "final_delivery"
    bundle = delivery / "model_bundle"
    checks: dict[str, bool] = {}
    evidence: dict[str, object] = {}

    inventory = json.loads((pipeline / "pilot_inventory.json").read_text(encoding="utf-8"))
    checks["01_six_pilot_models_frozen_with_hashes"] = bool(
        len(inventory.get("jobs", [])) == 6
        and all(len(job.get("model_sha256", "")) == 64 for job in inventory["jobs"])
    )

    validation = json.loads((pipeline / "evaluation_coordinator_validation.json").read_text(encoding="utf-8"))
    checks["02_six_pilot_validation_runs_complete"] = bool(
        validation.get("status") == "complete" and validation.get("jobs_completed") == 6
    )
    pilot_gates = json.loads((pipeline / "pilot_analysis" / "quality_gates.json").read_text(encoding="utf-8"))
    checks["03_pilot_technical_gates_pass"] = bool(pilot_gates.get("all_mandatory_gates_pass"))

    historical = json.loads((pipeline / "historical_coordinator.json").read_text(encoding="utf-8"))
    checks["04_six_pilot_historical_replays_complete"] = bool(
        historical.get("status") == "complete" and historical.get("jobs_completed") == 6
    )
    pilot_selection = json.loads((pipeline / "pilot_analysis" / "provisional_selection.json").read_text(encoding="utf-8"))
    checks["05_deployable_model_type_selected_without_oracle"] = bool(
        pilot_selection.get("selected_deployable_model_type") in {"P0_SCENARIO_BLIND", "P1_SCENARIO_CONDITIONED"}
        and pilot_selection.get("selected_deployable_model_type") != "P2_EVENT_ORACLE"
    )

    final_training = json.loads((pipeline / "final_training_coordinator.json").read_text(encoding="utf-8"))
    final_models = [Path(job["model_path"]) for job in final_training.get("completed", [])]
    checks["06_three_final_seed_trainings_complete"] = bool(
        final_training.get("status") == "complete"
        and final_training.get("jobs_completed") == 3
        and len(final_models) == 3
        and all(path.exists() for path in final_models)
    )

    selection = json.loads((pipeline / "final_checkpoint_selection_pretest.json").read_text(encoding="utf-8"))
    checks["07_checkpoint_and_seed_frozen_before_test"] = bool(
        selection.get("test_was_not_read_for_selection")
        and selection.get("selection_frozen_before_test_at")
        and len(selection.get("selected_by_seed", [])) == 3
    )
    extension = json.loads((pipeline / "controlled_extension_result.json").read_text(encoding="utf-8"))
    checks["08_below_gate_continuation_policy_recorded"] = bool(
        extension.get("required") is False
        or (extension.get("required") is True and "exit_code" in extension)
    )

    test_gates = json.loads((delivery / "final_test_quality_gates.json").read_text(encoding="utf-8"))
    checks["09_final_test_technical_gates_pass"] = bool(test_gates.get("all_mandatory_gates_pass"))
    episodes = pd.read_parquet(delivery / "final_test_all_episodes.parquet")
    counts = episodes.groupby(["model_seed", "family"]).size()
    checks["10_three_seeds_times_128_frozen_test_episodes"] = bool(
        len(episodes) == 384
        and episodes["model_seed"].nunique() == 3
        and set(episodes["family"].unique()) == {"S1", "S2"}
        and len(counts) == 6
        and bool((counts == 64).all())
    )
    evidence["final_test_episode_count"] = int(len(episodes))

    daily = pd.read_parquet(delivery / "final_test_all_daily.parquet")
    symbols = [
        "GARAN.E", "AKBNK.E", "ASELS.E", "BIMAS.E", "TUPRS.E", "THYAO.E",
        "FROTO.E", "KCHOL.E", "SAHOL.E", "SISE.E", "EREGL.E", "TCELL.E",
        "TAVHL.E", "MGROS.E", "TOASO.E", "ULKER.E", "TPP_ON",
    ]
    required_daily = {
        "date", "nav", "passive_nav", "reward", "reward_relative",
        "reward_mdd_absolute", "reward_mdd_relative", "reward_target_change",
        "realized_turnover", "commission", "post_trade_legal",
    }
    required_daily.update(f"target_weight_{symbol}" for symbol in symbols)
    required_daily.update(f"weight_{symbol}" for symbol in symbols)
    required_daily.update(f"trade_try_{symbol}" for symbol in symbols)
    required_daily.update(f"units_after_{symbol}" for symbol in symbols)
    checks["11_full_daily_money_weight_trade_logs_present"] = required_daily.issubset(daily.columns)
    reward_sum = daily[
        ["reward_relative", "reward_mdd_absolute", "reward_mdd_relative", "reward_target_change"]
    ].sum(axis=1)
    reward_error = float(np.max(np.abs(daily["reward"].to_numpy() - reward_sum.to_numpy())))
    checks["12_reward_recomposition_exact"] = reward_error <= 1e-10
    evidence["max_reward_recomposition_error"] = reward_error
    target_values = daily[[f"target_weight_{symbol}" for symbol in symbols]].to_numpy(dtype=float)
    checks["13_fractional_non_integer_weights_observed"] = bool(
        np.any(np.abs(target_values * 100.0 - np.round(target_values * 100.0)) > 1e-5)
    )
    checks["14_zero_final_test_prospectus_violations"] = bool(
        daily["post_trade_legal"].astype(bool).all() and int(episodes["illegal_days"].sum()) == 0
    )

    historical_episodes = pd.read_csv(delivery / "final_historical_episodes.csv")
    checks["15_three_seed_s1_s2_historical_replays_present"] = bool(
        len(historical_episodes) == 6
        and historical_episodes["model_seed"].nunique() == 3
        and set(historical_episodes["family"].unique()) == {"S1", "S2"}
    )
    checks["16_reward_component_counts_present"] = bool(
        (delivery / "final_reward_component_counts.csv").exists()
        and len(pd.read_csv(delivery / "final_reward_component_counts.csv")) == 24
    )
    plot_count = len(list((delivery / "plots").glob("*.png")))
    checks["17_at_least_25_final_graphs_present"] = plot_count >= 25
    evidence["plot_count"] = plot_count

    sensitivity = pd.read_csv(delivery / "feature_permutation_sensitivity.csv")
    checks["18_all_245_state_features_explained"] = bool(
        len(sensitivity) == 245 and sensitivity["feature_index"].nunique() == 245
    )

    required_bundle = {
        "ppo_model.zip", "resolved_config.yaml", "feature_contract.json",
        "action_contract.json", "reward_contract.json", "data_contract_v22.json",
        "instrument_order.json", "initial_target.json", "initial_portfolio_example.csv",
        "requirements.txt",
        "MODEL_CARD.md", "README_RUN.md", "TECHNICAL_ARCHITECTURE_V22.md",
        "deployment_manifest.json", "checksums.json", "pyproject.toml",
    }
    checks["19_reloadable_model_bundle_files_present"] = required_bundle.issubset(
        {path.name for path in bundle.iterdir() if path.is_file()}
    )
    PPO.load(bundle / "ppo_model.zip", device="cpu")
    checks["20_packaged_ppo_model_reloads"] = True
    expected_hashes = json.loads((bundle / "checksums.json").read_text(encoding="utf-8"))
    hash_failures = []
    for relative, expected in expected_hashes.items():
        target = bundle / relative
        if not target.exists() or _sha256(target) != expected:
            hash_failures.append(relative)
    checks["21_all_bundle_hashes_verify"] = len(hash_failures) == 0
    evidence["bundle_hash_failures"] = hash_failures
    checks["22_inference_source_packaged"] = bool(
        (bundle / "src" / "bist_stress_rl" / "inference_v22.py").exists()
        and (bundle / "src" / "bist_stress_rl" / "fixed_scenario_inference_v22.py").exists()
    )
    checks["23_technical_delivery_documents_present"] = bool(
        (delivery / "FINAL_TEKNIK_TESLIMAT.md").exists()
        and (delivery / "INFERENCE_KULLANIM_REHBERI.md").exists()
        and (root / "TECHNICAL_ARCHITECTURE_V22.md").exists()
    )
    checks["24_execution_log_preserved"] = bool(
        (pipeline / "execution_log.jsonl").exists()
        and (pipeline / "execution_log.jsonl").stat().st_size > 0
    )

    result = {
        "schema_version": "bist_stress_rl_v22_completion_audit",
        "audited_at": datetime.now().isoformat(timespec="seconds"),
        "checks": checks,
        "evidence": evidence,
        "passed": int(sum(checks.values())),
        "total": int(len(checks)),
        "all_requirements_pass": bool(all(checks.values())),
    }
    (delivery / "COMPLETION_AUDIT.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return result


def main() -> None:
    result = audit()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if not result["all_requirements_pass"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
