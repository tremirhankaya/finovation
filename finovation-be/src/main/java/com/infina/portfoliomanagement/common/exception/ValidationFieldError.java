package com.infina.portfoliomanagement.common.exception;

public record ValidationFieldError(
        String field,
        String message
) {
}
