from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.schemas.rl_inference import RlInferenceRequest, RlInferenceResponse
from api.settings import ServiceSettings


ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def client_and_app():
    app = create_app(ServiceSettings(ROOT))
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, app


def request_payload() -> dict:
    return json.loads(
        (ROOT / "examples" / "rl_inference_request.json").read_text(encoding="utf-8")
    )


def test_rl_runtime_preloads_all_packaged_models(client_and_app) -> None:
    _, app = client_and_app
    assert app.state.rl_runtime.ready is True
    assert app.state.rl_runtime.load_count == 1
    assert set(app.state.rl_runtime.engine.model_names) == {
        "PPO_MARKET_BASELINE",
        "PPO_STRESS_CONTEXT",
        "PPO_ASSET_IMPACT",
        "PPO_ADAPTIVE_RECOVERY",
    }


def test_rl_inference_returns_complete_daily_contract(client_and_app) -> None:
    client, _ = client_and_app
    response = client.post("/api/v1/rl/inference", json=request_payload())
    assert response.status_code == 200, response.text
    body = RlInferenceResponse.model_validate(response.json())
    assert body.model == "PPO_STRESS_CONTEXT"
    assert body.scenario == "SCENARIO_1_2025_03_17"
    assert body.trading_day_count == 32
    assert len(body.days) == 32
    assert body.days[0].day_number == 1
    assert body.days[0].date.isoformat() == "2025-03-17"
    assert body.days[-1].day_number == 32
    assert body.days[-1].date.isoformat() == "2025-05-05"
    assert body.final_nav == pytest.approx(8_600_757.96, abs=0.01)
    assert body.passive_final_nav == pytest.approx(8_293_323.43, abs=0.01)
    for day in body.days:
        assert set(day.weights) == set(request_payload()["initial_weights"])
        assert sum(day.weights.values()) == pytest.approx(1.0, abs=1e-10)


def test_rl_inference_is_deterministic(client_and_app) -> None:
    client, _ = client_and_app
    first = client.post("/api/v1/rl/inference", json=request_payload())
    second = client.post("/api/v1/rl/inference", json=request_payload())
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()


def test_rl_rejects_non_compliant_initial_portfolio(client_and_app) -> None:
    client, _ = client_and_app
    payload = request_payload()
    payload["initial_weights"]["ASELS.E"] = 0.02
    payload["initial_weights"]["CASH_TPP"] = 0.06
    response = client.post("/api/v1/rl/inference", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "RL_REQUEST_INVALID"


def test_rl_contract_rejects_unknown_fields(client_and_app) -> None:
    client, _ = client_and_app
    payload = request_payload()
    payload["start_date"] = "2025-03-17"
    response = client.post("/api/v1/rl/inference", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNKNOWN_REQUEST_FIELD"


def test_rl_models_validate_contract_examples() -> None:
    request = RlInferenceRequest.model_validate_json(
        (ROOT / "contracts" / "examples" / "rl-inference-request.json").read_text()
    )
    assert request.model == "PPO_STRESS_CONTEXT"
    response = RlInferenceResponse.model_validate_json(
        (ROOT / "contracts" / "examples" / "rl-inference-response.json").read_text()
    )
    assert len(response.days) == response.trading_day_count == 32


def test_openapi_exports_rl_endpoint(client_and_app) -> None:
    client, _ = client_and_app
    response = client.get("/openapi.json")
    assert response.status_code == 200
    operation = response.json()["paths"]["/api/v1/rl/inference"]["post"]
    assert (
        operation["requestBody"]["content"]["application/json"]["schema"]["$ref"]
        == "#/components/schemas/RlInferenceRequest"
    )
    example = operation["requestBody"]["content"]["application/json"]["examples"][
        "scenario_1_realistic_portfolio"
    ]["value"]
    assert example["initial_nav"] == 10_000_000.0
    assert set(example["initial_weights"]) == set(request_payload()["initial_weights"])
    assert sum(example["initial_weights"].values()) == pytest.approx(1.0)
