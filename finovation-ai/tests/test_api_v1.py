from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.schemas.create import CreateRequest, CreateResponse
from api.schemas.optimize import OptimizeRequest, OptimizeResponse
from api.settings import ServiceSettings


ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def client_and_app():
    app = create_app(ServiceSettings(ROOT))
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, app


def read_json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def assert_contract_headers(response) -> None:
    assert response.headers["X-API-Version"] == "v1"
    assert response.headers["X-Model-Snapshot"] == "FROZEN_2025-05-29_V3"
    assert response.headers["X-Model-Bundle"] == "EQUITY_FORECAST_BUNDLE_V3"
    assert (
        response.headers["X-Policy-Config"]
        == "PORTFOLIO_OBJECTIVES_V3_NEW_PROSPECTUS"
    )


def assert_engine_result_matches_golden(api_result: dict, golden: dict) -> None:
    assert api_result["request_id"] == golden["request_id"]
    assert api_result["mode"] == golden["mode"]
    assert api_result["system_date"] == golden["system_date"]
    assert api_result["forecast_origin"] == golden["forecast_origin"]
    assert api_result["policy_config_id"] == golden["policy_config_id"]
    assert api_result["alternatives"] == golden["alternatives"]
    assert api_result["api_version"] == "v1"
    assert api_result["snapshot_id"] == "FROZEN_2025-05-29_V3"
    assert api_result["model_bundle_id"] == "EQUITY_FORECAST_BUNDLE_V3"
    assert api_result["processing_time_ms"] >= 0.0


def test_health_metadata_and_single_runtime_load(client_and_app) -> None:
    client, app = client_and_app
    live = client.get("/health/live")
    ready = client.get("/health/ready")
    metadata = client.get("/api/v1/metadata")
    assert live.status_code == 200
    assert live.json() == {"status": "LIVE", "api_version": "v1"}
    assert ready.status_code == 200
    assert ready.json()["snapshot_id"] == "FROZEN_2025-05-29_V3"
    assert metadata.status_code == 200
    body = metadata.json()
    assert body["system_date"] == "2025-05-29"
    assert body["forecast_origin"] == "2025-05-28"
    assert len(body["universe"]) == 58
    assert body["supported_horizons"] == ["3M", "6M", "12M"]
    assert body["policy"]["stock_min"] == 0.03
    assert app.state.runtime.load_count == 1
    assert_contract_headers(metadata)


def test_forecasts_return_exact_58_and_snapshot_header(client_and_app) -> None:
    client, _ = client_and_app
    response = client.get(
        "/api/v1/forecasts?horizon=6M",
        headers={"X-Expected-Model-Snapshot": "FROZEN_2025-05-29_V3"},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["rows"]) == 58
    assert {row["horizon_months"] for row in body["rows"]} == {6}
    assert len({row["instrument_id"] for row in body["rows"]}) == 58
    assert_contract_headers(response)


def test_create_matches_existing_golden_result(client_and_app) -> None:
    client, app = client_and_app
    request = read_json("examples/create_request.json")
    golden = read_json("outputs/examples/create_result.json")
    response = client.post("/api/v1/portfolios/create", json=request)
    assert response.status_code == 200, response.text
    assert response.headers["X-Request-Id"] == request["request_id"]
    assert_engine_result_matches_golden(response.json(), golden)
    assert app.state.runtime.load_count == 1
    assert_contract_headers(response)


def test_optimize_matches_existing_golden_result(client_and_app) -> None:
    client, app = client_and_app
    request = read_json("examples/optimize_request.json")
    golden = read_json("outputs/examples/optimize_result.json")
    response = client.post("/api/v1/portfolios/optimize", json=request)
    assert response.status_code == 200, response.text
    assert_engine_result_matches_golden(response.json(), golden)
    assert app.state.runtime.load_count == 1
    assert_contract_headers(response)


def test_optimize_api_honors_mandatory_and_excluded_assets(client_and_app) -> None:
    client, _ = client_and_app
    request = read_json("examples/optimize_request.json")
    request.update(
        {
            "request_id": "optimize-membership-constraints-001",
            "mandatory_assets": ["NETAS.E", "TCELL.E"],
            "excluded_assets": ["AEFES.E", "FENER.E"],
            "max_weight_change_per_asset": 0.065,
            "max_additions": 2,
            "max_removals": 2,
        }
    )
    response = client.post("/api/v1/portfolios/optimize", json=request)
    assert response.status_code == 200, response.text
    for alternative in response.json()["alternatives"]:
        assert {"NETAS.E", "TCELL.E"}.issubset(alternative["weights"])
        assert {"AEFES.E", "FENER.E"}.isdisjoint(alternative["weights"])
        assert "NETAS.E" in alternative["added_assets"]
        assert "AEFES.E" in alternative["removed_assets"]
        assert alternative["large_position_total_weight"] < 0.40
        assert max(alternative["sector_exposures"].values()) <= 0.30 + 2e-7


@pytest.mark.parametrize(
    ("change", "expected_code"),
    [
        (
            {
                "mandatory_assets": ["TCELL.E"],
                "excluded_assets": ["TCELL.E"],
            },
            "MANDATORY_EXCLUDED_OVERLAP",
        ),
        (
            {"excluded_assets": ["ASELS.E"]},
            "LOCKED_EXCLUDED_OVERLAP",
        ),
        (
            {"mandatory_assets": ["NETAS.E"], "max_additions": 0},
            "MAX_ADDITIONS_CONSTRAINT_CONFLICT",
        ),
        (
            {"excluded_assets": ["AEFES.E"], "max_removals": 0},
            "MAX_REMOVALS_CONSTRAINT_CONFLICT",
        ),
        (
            {"excluded_assets": ["AEFES.E"]},
            "MAX_WEIGHT_CHANGE_CONSTRAINT_CONFLICT",
        ),
    ],
)
def test_optimize_membership_constraint_errors_are_explicit(
    client_and_app, change: dict, expected_code: str
) -> None:
    client, _ = client_and_app
    request = read_json("examples/optimize_request.json")
    request.update(change)
    response = client.post("/api/v1/portfolios/optimize", json=request)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == expected_code


def test_same_create_request_is_deterministic(client_and_app) -> None:
    client, _ = client_and_app
    request = read_json("examples/create_request.json")
    first = client.post("/api/v1/portfolios/create", json=request).json()
    second = client.post("/api/v1/portfolios/create", json=request).json()
    first.pop("processing_time_ms")
    second.pop("processing_time_ms")
    assert first == second


def test_unknown_field_is_rejected(client_and_app) -> None:
    client, _ = client_and_app
    request = read_json("examples/create_request.json")
    request["as_of_date"] = "2026-08-07"
    response = client.post("/api/v1/portfolios/create", json=request)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNKNOWN_REQUEST_FIELD"


def test_malformed_json_uses_standard_error_envelope(client_and_app) -> None:
    client, _ = client_and_app
    response = client.post(
        "/api/v1/portfolios/create",
        content=b'{"horizon":',
        headers={"Content-Type": "application/json", "X-Request-Id": "bad-json-1"},
    )
    assert response.status_code == 400
    body = response.json()
    assert body["request_id"] == "bad-json-1"
    assert body["error"]["code"] == "MALFORMED_JSON"


def test_invalid_portfolio_sum_is_not_normalized(client_and_app) -> None:
    client, _ = client_and_app
    request = read_json("examples/optimize_request.json")
    request["current_portfolio"]["CASH_TPP"] += 0.01
    response = client.post("/api/v1/portfolios/optimize", json=request)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "PORTFOLIO_SUM_INVALID"


def test_snapshot_mismatch_is_409(client_and_app) -> None:
    client, _ = client_and_app
    request = read_json("examples/create_request.json")
    response = client.post(
        "/api/v1/portfolios/create",
        json=request,
        headers={"X-Expected-Model-Snapshot": "LIVE_2026-08-07_V1"},
    )
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "SNAPSHOT_MISMATCH"
    assert body["error"]["details"]["active"] == "FROZEN_2025-05-29_V3"


def test_request_id_header_and_body_must_match(client_and_app) -> None:
    client, _ = client_and_app
    request = read_json("examples/create_request.json")
    response = client.post(
        "/api/v1/portfolios/create",
        json=request,
        headers={"X-Request-Id": "different-request-id"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "REQUEST_ID_MISMATCH"


def test_header_request_id_is_used_when_body_omits_it(client_and_app) -> None:
    client, _ = client_and_app
    request = read_json("examples/create_request.json")
    request.pop("request_id")
    response = client.post(
        "/api/v1/portfolios/create",
        json=request,
        headers={"X-Request-Id": "header-only-create-001"},
    )
    assert response.status_code == 200
    assert response.json()["request_id"] == "header-only-create-001"
    assert response.headers["X-Request-Id"] == "header-only-create-001"


def test_turkish_reason_text_is_utf8(client_and_app) -> None:
    client, _ = client_and_app
    request = read_json("examples/create_request.json")
    response = client.post("/api/v1/portfolios/create", json=request)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json; charset=utf-8"
    texts = [
        text
        for alternative in response.json()["alternatives"]
        for values in alternative["reason_texts"].values()
        for text in values
    ]
    assert any("ağırlığı" in text or "ağırlık" in text for text in texts)


def test_runtime_failure_keeps_live_but_not_ready(tmp_path) -> None:
    app = create_app(ServiceSettings(tmp_path))
    with TestClient(app, raise_server_exceptions=False) as client:
        assert client.get("/health/live").status_code == 200
        ready = client.get("/health/ready")
        assert ready.status_code == 503
        assert ready.json()["error"]["code"] == "RUNTIME_NOT_READY"
        create = client.post(
            "/api/v1/portfolios/create",
            json=read_json("examples/create_request.json"),
        )
        assert create.status_code == 503
        assert create.json()["error"]["code"] == "RUNTIME_NOT_READY"


def test_openapi_contains_complete_v1_surface(client_and_app) -> None:
    client, _ = client_and_app
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = set(response.json()["paths"])
    assert {
        "/health/live",
        "/health/ready",
        "/api/v1/metadata",
        "/api/v1/forecasts",
        "/api/v1/portfolios/create",
        "/api/v1/portfolios/optimize",
    }.issubset(paths)
    create_422 = response.json()["paths"]["/api/v1/portfolios/create"]["post"][
        "responses"
    ]["422"]
    media = create_422["content"]["application/json; charset=utf-8"]
    assert media["schema"]["$ref"] == "#/components/schemas/ErrorResponse"
    optimize_schema = response.json()["components"]["schemas"]["OptimizeRequest"]
    assert "mandatory_assets" in optimize_schema["properties"]
    assert "excluded_assets" in optimize_schema["properties"]


def test_exported_contract_examples_validate_against_models() -> None:
    contracts = ROOT / "contracts"
    exported_openapi = json.loads(
        (contracts / "openapi-v1.json").read_text(encoding="utf-8")
    )
    assert exported_openapi["info"]["version"] == "1.0.0"
    examples = contracts / "examples"
    CreateRequest.model_validate_json((examples / "create-request.json").read_text())
    OptimizeRequest.model_validate_json((examples / "optimize-request.json").read_text())
    CreateResponse.model_validate_json((examples / "create-response.json").read_text())
    OptimizeResponse.model_validate_json((examples / "optimize-response.json").read_text())
