from __future__ import annotations

from time import perf_counter

from fastapi import APIRouter, Depends, Request

from api.dependencies import require_runtime, resolve_request_id
from api.openapi_contract import ERROR_RESPONSES
from api.presenters import versioned_engine_result
from api.runtime import RuntimeState
from api.schemas.create import CreateRequest, CreateResponse
from api.schemas.optimize import OptimizeRequest, OptimizeResponse


router = APIRouter(prefix="/api/v1/portfolios", tags=["portfolios"])


@router.post(
    "/create",
    response_model=CreateResponse,
    responses=ERROR_RESPONSES,
    summary="Create two frozen-snapshot portfolio alternatives",
)
def create_portfolio(
    payload: CreateRequest,
    request: Request,
    runtime: RuntimeState = Depends(require_runtime),
) -> dict:
    request_id = resolve_request_id(request, payload.request_id)
    started_at = perf_counter()
    assert runtime.engine is not None
    engine_payload = payload.engine_payload()
    if request_id is not None:
        engine_payload["request_id"] = request_id
    result = runtime.engine.create(engine_payload)
    return versioned_engine_result(runtime, result, started_at)


@router.post(
    "/optimize",
    response_model=OptimizeResponse,
    responses=ERROR_RESPONSES,
    summary="Optimize a compliant current portfolio into three alternatives",
)
def optimize_portfolio(
    payload: OptimizeRequest,
    request: Request,
    runtime: RuntimeState = Depends(require_runtime),
) -> dict:
    request_id = resolve_request_id(request, payload.request_id)
    started_at = perf_counter()
    assert runtime.engine is not None
    engine_payload = payload.engine_payload()
    if request_id is not None:
        engine_payload["request_id"] = request_id
    result = runtime.engine.optimize(engine_payload)
    return versioned_engine_result(runtime, result, started_at)
