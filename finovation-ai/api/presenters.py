from __future__ import annotations

from time import perf_counter

from api.runtime import RuntimeState


def version_fields(runtime: RuntimeState) -> dict:
    bundles = runtime.bundles
    if bundles is None or runtime.snapshot_id is None:
        raise RuntimeError("Runtime is not ready")
    return {
        "api_version": runtime.settings.api_version,
        "snapshot_id": runtime.snapshot_id,
        "system_date": bundles.project["system_date"],
        "forecast_origin": bundles.project["forecast_origin"],
        "model_bundle_id": bundles.forecast_manifest["schema_version"],
        "policy_config_id": bundles.objectives["config_id"],
    }


def versioned_engine_result(
    runtime: RuntimeState, result: dict, started_at: float
) -> dict:
    output = dict(result)
    output.update(version_fields(runtime))
    output["processing_time_ms"] = (perf_counter() - started_at) * 1000.0
    return output
