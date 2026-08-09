from __future__ import annotations

import logging
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from fund_ml.portfolio import PortfolioError

from api.schemas.common import ErrorBody, ErrorResponse
from api.responses import Utf8JSONResponse


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def _runtime_snapshot(request: Request) -> str | None:
    runtime = getattr(request.app.state, "runtime", None)
    return runtime.snapshot_id if runtime is not None else None


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        request_id=_request_id(request),
        error=ErrorBody(code=code, message=message, details=details or {}),
        snapshot_id=_runtime_snapshot(request),
    )
    return Utf8JSONResponse(
        status_code=status_code, content=body.model_dump(mode="json")
    )


def portfolio_error_code(message: str) -> str:
    lowered = message.lower()
    mappings = (
        ("unknown request fields", "UNKNOWN_REQUEST_FIELD"),
        ("missing request fields", "MISSING_REQUIRED_FIELD"),
        ("horizon must", "INVALID_HORIZON"),
        ("unknown assets", "UNKNOWN_ASSET"),
        ("current portfolio has unknown assets", "UNKNOWN_ASSET"),
        ("mandatory and excluded", "MANDATORY_EXCLUDED_OVERLAP"),
        ("locked and excluded", "LOCKED_EXCLUDED_OVERLAP"),
        ("mandatory additions exceed", "MAX_ADDITIONS_CONSTRAINT_CONFLICT"),
        ("excluded removals exceed", "MAX_REMOVALS_CONSTRAINT_CONFLICT"),
        ("max_weight_change_per_asset", "MAX_WEIGHT_CHANGE_CONSTRAINT_CONFLICT"),
        ("fewer candidates than min_stock_count", "STOCK_COUNT_OUT_OF_RANGE"),
        ("stock-count", "STOCK_COUNT_OUT_OF_RANGE"),
        ("stock count", "STOCK_COUNT_OUT_OF_RANGE"),
        ("tpp range", "TPP_RANGE_OUT_OF_RANGE"),
        ("sum to one", "PORTFOLIO_SUM_INVALID"),
        ("locked asset", "LOCKED_WEIGHT_MISMATCH"),
        ("current cash_tpp", "CURRENT_PORTFOLIO_POLICY_VIOLATION"),
        ("current stock weight", "CURRENT_PORTFOLIO_POLICY_VIOLATION"),
        ("current sector exposure", "CURRENT_PORTFOLIO_POLICY_VIOLATION"),
        ("current total weight", "CURRENT_PORTFOLIO_POLICY_VIOLATION"),
        ("model_horizon_not_eligible", "MODEL_HORIZON_NOT_ELIGIBLE"),
        ("infeasible_create", "INFEASIBLE_CREATE"),
        ("infeasible_optimize", "INFEASIBLE_OPTIMIZE"),
    )
    for needle, code in mappings:
        if needle in lowered:
            return code
    return "BUSINESS_RULE_VIOLATION"


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return error_response(
        request, exc.status_code, exc.code, exc.message, exc.details
    )


async def portfolio_error_handler(request: Request, exc: PortfolioError) -> JSONResponse:
    return error_response(
        request,
        422,
        portfolio_error_code(str(exc)),
        str(exc),
    )


def _validation_code(errors: list[dict[str, Any]]) -> tuple[int, str]:
    types = {str(item.get("type")) for item in errors}
    messages = " | ".join(str(item.get("msg", "")).lower() for item in errors)
    locations = {
        str(part)
        for item in errors
        for part in item.get("loc", ())
    }
    if "json_invalid" in types:
        return 400, "MALFORMED_JSON"
    if "extra_forbidden" in types:
        return 422, "UNKNOWN_REQUEST_FIELD"
    if "missing" in types:
        return 422, "MISSING_REQUIRED_FIELD"
    if "current_portfolio must sum" in messages:
        return 422, "PORTFOLIO_SUM_INVALID"
    if "locked" in messages:
        if "excluded" in messages:
            return 422, "LOCKED_EXCLUDED_OVERLAP"
        return 422, "LOCKED_WEIGHT_MISMATCH"
    if "mandatory and excluded" in messages:
        return 422, "MANDATORY_EXCLUDED_OVERLAP"
    if "horizon" in locations:
        return 422, "INVALID_HORIZON"
    if {"min_stock_count", "max_stock_count"} & locations:
        return 422, "STOCK_COUNT_OUT_OF_RANGE"
    if {"tpp_min_weight", "tpp_max_weight"} & locations:
        return 422, "TPP_RANGE_OUT_OF_RANGE"
    return 422, "REQUEST_VALIDATION_FAILED"


async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    raw = exc.errors()
    status_code, code = _validation_code(raw)
    details = {
        "errors": [
            {
                "location": [str(part) for part in item.get("loc", ())],
                "type": str(item.get("type", "validation_error")),
                "message": str(item.get("msg", "Invalid value")),
            }
            for item in raw
        ]
    }
    return error_response(request, status_code, code, "Request validation failed", details)


async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logging.getLogger("fund_ml.api").exception(
        "unexpected_error request_id=%s path=%s",
        _request_id(request),
        request.url.path,
        exc_info=exc,
    )
    return error_response(
        request,
        500,
        "INTERNAL_ERROR",
        "Unexpected internal service error",
    )
