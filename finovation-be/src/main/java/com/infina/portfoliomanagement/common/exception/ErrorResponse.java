package com.infina.portfoliomanagement.common.exception;

import java.time.LocalDateTime;
import java.util.List;

public record ErrorResponse(
        LocalDateTime timestamp,

        int status,

        String code,

        String message,

        String path,

        List<ValidationFieldError> errors
) {
}
