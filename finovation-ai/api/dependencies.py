from __future__ import annotations

from fastapi import Header, Request

from api.errors import ApiError
from api.runtime import RuntimeState
from api.settings import ServiceSettings

def verify_api_key(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    settings: ServiceSettings = request.app.state.settings
    if not settings.api_key:
        return

    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif x_api_key:
        token = x_api_key

    if token != settings.api_key:
        raise ApiError(401, "UNAUTHORIZED", "Invalid API Key")


def require_runtime(
    request: Request,
    request_id: str | None = Header(default=None, alias="X-Request-Id"),
    expected_snapshot: str | None = Header(
        default=None, alias="X-Expected-Model-Snapshot"
    ),
) -> RuntimeState:
    if request_id is not None:
        request.state.request_id = request_id
    runtime: RuntimeState = request.app.state.runtime
    if not runtime.ready or runtime.engine is None:
        raise ApiError(503, "RUNTIME_NOT_READY", "Model runtime is not ready")
    if expected_snapshot is not None and expected_snapshot != runtime.snapshot_id:
        raise ApiError(
            409,
            "SNAPSHOT_MISMATCH",
            "Expected model snapshot does not match the active snapshot",
            {"expected": expected_snapshot, "active": runtime.snapshot_id},
        )
    return runtime


def resolve_request_id(request: Request, body_request_id: str | None) -> str | None:
    header_request_id = getattr(request.state, "request_id", None)
    if (
        header_request_id is not None
        and body_request_id is not None
        and header_request_id != body_request_id
    ):
        raise ApiError(
            409,
            "REQUEST_ID_MISMATCH",
            "X-Request-Id header and request_id body field do not match",
            {"header": header_request_id, "body": body_request_id},
        )
    resolved = body_request_id or header_request_id
    request.state.request_id = resolved
    return resolved
