from __future__ import annotations

import argparse
import json
from pathlib import Path

from api.main import create_app
from api.presenters import version_fields
from api.runtime import RuntimeState
from api.schemas.common import ErrorBody, ErrorResponse
from api.settings import ServiceSettings


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def versioned_example(runtime: RuntimeState, engine_result: dict) -> dict:
    output = dict(engine_result)
    output.update(version_fields(runtime))
    output["processing_time_ms"] = 0.0
    return output


def export(root: Path) -> None:
    root = root.resolve()
    settings = ServiceSettings(root)
    app = create_app(settings)
    contracts = root / "contracts"
    examples = contracts / "examples"

    write_json(contracts / "openapi-v1.json", app.openapi())

    runtime = RuntimeState(settings)
    runtime.initialize()
    if not runtime.ready or runtime.engine is None:
        raise RuntimeError(runtime.startup_error or "Runtime is not ready")

    create_request = json.loads(
        (root / "examples" / "create_request.json").read_text(encoding="utf-8")
    )
    optimize_request = json.loads(
        (root / "examples" / "optimize_request.json").read_text(encoding="utf-8")
    )
    create_response = versioned_example(
        runtime, runtime.engine.create(create_request)
    )
    optimize_response = versioned_example(
        runtime, runtime.engine.optimize(optimize_request)
    )
    error = ErrorResponse(
        request_id="optimize-invalid-001",
        error=ErrorBody(
            code="PORTFOLIO_SUM_INVALID",
            message="Current portfolio weights must sum to 1.0.",
            details={"received_sum": 0.97, "expected_sum": 1.0},
        ),
        snapshot_id=runtime.snapshot_id,
    )

    write_json(examples / "create-request.json", create_request)
    write_json(examples / "create-response.json", create_response)
    write_json(examples / "optimize-request.json", optimize_request)
    write_json(examples / "optimize-response.json", optimize_response)
    write_json(examples / "error-response.json", error.model_dump(mode="json"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Export frozen API V1 contract")
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    export(args.root)


if __name__ == "__main__":
    main()
