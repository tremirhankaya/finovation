package com.infina.portfoliomanagement.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {

    INTERNAL_SERVER_ERROR(
            "GEN_001",
            HttpStatus.INTERNAL_SERVER_ERROR,
            "Unexpected server error."
    ),

    INVALID_CREDENTIALS(
            "AUTH_001",
            HttpStatus.UNAUTHORIZED,
            "Invalid username or password."
    ),

    INVALID_TOKEN(
            "AUTH_002",
            HttpStatus.UNAUTHORIZED,
            "Invalid token."
    ),

    TOKEN_EXPIRED(
            "AUTH_003",
            HttpStatus.UNAUTHORIZED,
            "Token has expired."
    ),

    ACCESS_DENIED(
            "AUTH_004",
            HttpStatus.FORBIDDEN,
            "You do not have permission to perform this operation."
    ),


    USER_NOT_FOUND(
            "USER_001",
            HttpStatus.NOT_FOUND,
            "User not found."
    ),

    EMAIL_ALREADY_EXISTS(
            "USER_002",
            HttpStatus.CONFLICT,
            "Email already exists."
    ),VALIDATION_ERROR(
            "GEN_400",
            HttpStatus.BAD_REQUEST,
            "Validation failed."
    ),
    ;

    private final String code;
    private final HttpStatus httpStatus;
    private final String message;

    ErrorCode(String code, HttpStatus httpStatus, String message) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.message = message;
    }
}
