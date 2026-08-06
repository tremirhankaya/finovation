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

    REFRESH_TOKEN_RATE_LIMITED(
            "AUTH_017",
            HttpStatus.TOO_MANY_REQUESTS,
            "Too many token refresh requests from this network. Please try again later."
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

    EXTERNAL_SERVICE_ERROR(
            "EXT_001",
            HttpStatus.BAD_GATEWAY,
            "External service returned an error."
    ),

    OPT_REQUEST_NOT_FOUND(
            "OPT_001",
            HttpStatus.NOT_FOUND,
            "Optimization request not found."
    ),

    OPT_ASSET_NOT_IN_UNIVERSE(
            "OPT_002",
            HttpStatus.BAD_REQUEST,
            "The asset is not part of the defined investment universe."
    ),

    OPT_INVALID_CONSTRAINT_VALUE(
            "OPT_003",
            HttpStatus.BAD_REQUEST,
            "The constraint value is outside the allowed range."
    ),

    OPT_CONSTRAINT_SET_INFEASIBLE(
            "OPT_004",
            HttpStatus.BAD_REQUEST,
            "The combined constraints cannot be satisfied together."
    ),

    OPT_ASSET_PREFERENCE_CONFLICT(
            "OPT_005",
            HttpStatus.BAD_REQUEST,
            "An asset cannot have more than one active preference in the same request."
    ),

    OPT_ASSET_LIMIT_INVALID(
            "OPT_006",
            HttpStatus.BAD_REQUEST,
            "The asset limit override's minimum weight must not exceed its maximum weight."
    ),

    OPT_VERSION_CONFLICT(
            "OPT_007",
            HttpStatus.CONFLICT,
            "This request was modified by another request. Please reload and try again."
    ),

    OPT_INVALID_STATUS_TRANSITION(
            "OPT_008",
            HttpStatus.CONFLICT,
            "This optimization request cannot change to the requested status from its current status."
    ),

    FUND_INITIAL_SIZE_OUT_OF_RANGE(
            "FUND_001",
            HttpStatus.BAD_REQUEST,
            "The initial portfolio size is outside the allowed range."
    ),

    FUND_NOT_FOUND(
            "FUND_002",
            HttpStatus.NOT_FOUND,
            "Fund not found."
    ),

    FUND_MONITORING_DATA_UNAVAILABLE(
            "FUND_003",
            HttpStatus.UNPROCESSABLE_ENTITY,
            "Fund monitoring data is not available."
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
