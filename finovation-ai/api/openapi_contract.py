from __future__ import annotations

from api.schemas.common import ErrorResponse


ERROR_RESPONSES = {
    400: {"model": ErrorResponse, "description": "Malformed JSON request"},
    409: {"model": ErrorResponse, "description": "Snapshot or request conflict"},
    422: {"model": ErrorResponse, "description": "Validation or business rule failure"},
    500: {"model": ErrorResponse, "description": "Unexpected internal error"},
    503: {"model": ErrorResponse, "description": "Runtime bundle is not ready"},
}


READINESS_ERROR_RESPONSE = {
    503: {"model": ErrorResponse, "description": "Runtime bundle is not ready"}
}
