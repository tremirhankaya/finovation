from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, Request

from api.errors import ApiError
from api.openapi_contract import ERROR_RESPONSES
from api.rl_runtime import RlRuntimeState
from api.schemas.rl_inference import (
    RL_REQUEST_EXAMPLE,
    RlInferenceRequest,
    RlInferenceResponse,
)
from bist_stress_service import RlInferenceError


router = APIRouter(prefix="/api/v1/rl", tags=["rl-inference"])


@router.post(
    "/inference",
    response_model=RlInferenceResponse,
    responses=ERROR_RESPONSES,
    summary="Run a packaged PPO policy on one fixed historical stress scenario",
)
def run_rl_inference(
    payload: Annotated[
        RlInferenceRequest,
        Body(
            openapi_examples={
                "scenario_1_realistic_portfolio": {
                    "summary": "10 milyon TL başlangıç portföyü",
                    "description": (
                        "İzahnameye uygun 16 hisse ve yüzde 5 CASH_TPP ile "
                        "birinci sabit senaryoyu çalıştırır."
                    ),
                    "value": RL_REQUEST_EXAMPLE,
                }
            }
        ),
    ],
    request: Request,
) -> dict:
    runtime: RlRuntimeState | None = getattr(request.app.state, "rl_runtime", None)
    if runtime is None or not runtime.ready or runtime.engine is None:
        details = {
            "startup_error": runtime.startup_error if runtime is not None else None
        }
        raise ApiError(
            503,
            "RL_RUNTIME_NOT_READY",
            "RL inference runtime is not ready",
            details,
        )
    try:
        return runtime.engine.infer(
            model_name=payload.model,
            scenario_name=payload.scenario,
            initial_nav=payload.initial_nav,
            initial_weights=payload.initial_weights,
        )
    except RlInferenceError as exc:
        raise ApiError(422, "RL_REQUEST_INVALID", str(exc)) from exc
