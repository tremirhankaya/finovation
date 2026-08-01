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

    AUTHENTICATION_REQUIRED(
            "AUTH_005",
            HttpStatus.UNAUTHORIZED,
            "Authentication is required to access this resource."
    ),

    PASSWORD_RESET_ACCOUNT_NOT_FOUND(
            "AUTH_006",
            HttpStatus.NOT_FOUND,
            "No account was found for this email address."
    ),

    PASSWORD_RESET_OTP_INVALID(
            "AUTH_007",
            HttpStatus.BAD_REQUEST,
            "The verification code is invalid."
    ),

    PASSWORD_RESET_OTP_EXPIRED(
            "AUTH_008",
            HttpStatus.GONE,
            "The verification code has expired. Request a new code."
    ),

    PASSWORD_RESET_REQUEST_TOO_SOON(
            "AUTH_009",
            HttpStatus.TOO_MANY_REQUESTS,
            "Please wait before requesting another verification code."
    ),

    PASSWORD_RESET_ATTEMPTS_EXCEEDED(
            "AUTH_010",
            HttpStatus.TOO_MANY_REQUESTS,
            "Too many incorrect verification attempts. Request a new code."
    ),

    PASSWORD_RESET_TOKEN_INVALID_OR_EXPIRED(
            "AUTH_011",
            HttpStatus.BAD_REQUEST,
            "The password reset session is invalid or has expired."
    ),

    PASSWORD_RESET_PASSWORDS_DO_NOT_MATCH(
            "AUTH_012",
            HttpStatus.BAD_REQUEST,
            "The passwords do not match."
    ),

    PASSWORD_RESET_MAIL_DELIVERY_FAILED(
            "AUTH_013",
            HttpStatus.SERVICE_UNAVAILABLE,
            "The verification email could not be sent. Please try again later."
    ),

    LOGIN_ATTEMPTS_EXCEEDED(
            "AUTH_014",
            HttpStatus.TOO_MANY_REQUESTS,
            "Too many failed login attempts. Please try again later."
    ),

    PASSWORD_RESET_REQUEST_IP_RATE_LIMITED(
            "AUTH_015",
            HttpStatus.TOO_MANY_REQUESTS,
            "Too many verification code requests from this network. Please try again later."
    ),

    PASSWORD_RESET_VERIFY_IP_RATE_LIMITED(
            "AUTH_016",
            HttpStatus.TOO_MANY_REQUESTS,
            "Too many verification attempts from this network. Please try again later."
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
    ),

    USERNAME_ALREADY_EXISTS(
            "USER_003",
            HttpStatus.CONFLICT,
            "Username already exists."
    ),

    VALIDATION_ERROR(
            "GEN_400",
            HttpStatus.BAD_REQUEST,
            "Validation failed."
    ),

    COMPANY_NOT_FOUND(
            "COMPANY_001",
            HttpStatus.NOT_FOUND,
            "Company not found."
    ),

    COMPANY_ASSIGNMENT_INVALID(
            "COMPANY_002",
            HttpStatus.BAD_REQUEST,
            "Company assignment is invalid for the given role."
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
