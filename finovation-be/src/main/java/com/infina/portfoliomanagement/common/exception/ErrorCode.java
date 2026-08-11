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

    PASSWORD_MUST_DIFFER_FROM_CURRENT(
            "AUTH_018",
            HttpStatus.BAD_REQUEST,
            "The new password must be different from the current password."
    ),

    PASSWORD_CHANGE_REQUIRED(
            "AUTH_019",
            HttpStatus.FORBIDDEN,
            "You must change your password before accessing this resource."
    ),

    ACCOUNT_INACTIVE(
            "AUTH_020",
            HttpStatus.UNAUTHORIZED,
            "This account is not active."
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

    COMPANY_NAME_ALREADY_EXISTS(
            "COMPANY_003",
            HttpStatus.CONFLICT,
            "Company name already exists."
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
    OPT_MAX_ADDITIONS_EXCEEDED(
            "OPT_009",
            HttpStatus.BAD_REQUEST,
            "The number of force-added stocks exceeds the maximum additions limit for this optimization."
    ),

    OPT_MAX_REMOVALS_EXCEEDED(
            "OPT_010",
            HttpStatus.BAD_REQUEST,
            "The number of excluded stocks exceeds the maximum removals limit for this optimization."
    ),

    OPT_WEIGHT_CHANGE_LIMIT_EXCEEDED(
            "OPT_011",
            HttpStatus.BAD_REQUEST,
            "A force-added or excluded stock's required weight change exceeds the maximum allowed change per asset."
    ),

    OPT_RESULT_NOT_FOUND(
            "OPT_012",
            HttpStatus.NOT_FOUND,
            "No result is available yet for this optimization request."
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

    FUND_DRAFT_NOT_FOUND(
            "FUND_004",
            HttpStatus.NOT_FOUND,
            "Fund draft not found."
    ),

    FUND_DESIGN_PROFILE_NOT_FOUND(
            "FUND_005",
            HttpStatus.NOT_FOUND,
            "Fund design profile not found."
    ),

    FUND_UNIT_PRICE_OUT_OF_RANGE(
            "FUND_006",
            HttpStatus.BAD_REQUEST,
            "The unit price is outside the allowed range."
    ),

    FUND_NAME_INVALID(
            "FUND_007",
            HttpStatus.BAD_REQUEST,
            "The fund name is invalid."
    ),

    FUND_PORTFOLIO_RULES_INVALID(
            "FUND_008",
            HttpStatus.BAD_REQUEST,
            "The portfolio rules are outside the allowed bounds."
    ),

    FUND_STRATEGY_INCOMPLETE(
            "FUND_009",
            HttpStatus.BAD_REQUEST,
            "Portfolio rules must be saved before running AI analysis."
    ),

    FUND_MODEL_UNIVERSE_EMPTY(
            "FUND_010",
            HttpStatus.INTERNAL_SERVER_ERROR,
            "No equity assets are available in the model universe."
    ),

    FUND_ASSET_PREFERENCE_INVALID(
            "FUND_011",
            HttpStatus.BAD_REQUEST,
            "Excluded or forced assets are invalid for this fund draft."
    ),

    FUND_INIT_PAGE_INVALID(
            "FUND_012",
            HttpStatus.BAD_REQUEST,
            "Fund draft init page is invalid or missing required parameters."
    ),

    FUND_ANALYSIS_NOT_FOUND(
            "FUND_013",
            HttpStatus.NOT_FOUND,
            "No matching analysis result was found for this fund draft."
    ),

    FUND_PROPOSAL_NOT_FOUND(
            "FUND_014",
            HttpStatus.NOT_FOUND,
            "The selected proposal was not found for this analysis."
    ),

    FUND_WORKING_PORTFOLIO_INVALID(
            "FUND_015",
            HttpStatus.BAD_REQUEST,
            "The working portfolio payload is invalid."
    ),

    FUND_RULE_TOTAL_WEIGHT(
            "FUND_016",
            HttpStatus.BAD_REQUEST,
            "Portfolio weights must total 100%."
    ),

    FUND_RULE_EQUITY_MIN(
            "FUND_017",
            HttpStatus.BAD_REQUEST,
            "Total equity weight is below the required minimum."
    ),

    FUND_RULE_EQUITY_MAX(
            "FUND_018",
            HttpStatus.BAD_REQUEST,
            "Total equity weight exceeds the allowed maximum."
    ),

    FUND_RULE_TPP_MIN(
            "FUND_019",
            HttpStatus.BAD_REQUEST,
            "Total TPP weight is below the required minimum."
    ),

    FUND_RULE_TPP_MAX(
            "FUND_020",
            HttpStatus.BAD_REQUEST,
            "Total TPP weight exceeds the allowed maximum."
    ),

    FUND_RULE_SINGLE_STOCK_MAX(
            "FUND_021",
            HttpStatus.BAD_REQUEST,
            "A single stock exceeds the allowed maximum weight."
    ),

    FUND_RULE_ABOVE_THRESHOLD_SUM_MAX(
            "FUND_022",
            HttpStatus.BAD_REQUEST,
            "The combined weight of large positions exceeds the allowed maximum."
    ),

    FUND_RULE_SECTOR_MAX(
            "FUND_023",
            HttpStatus.BAD_REQUEST,
            "A sector exceeds the allowed maximum weight."
    ),

    FUND_RULE_MIN_STOCK_COUNT(
            "FUND_024",
            HttpStatus.BAD_REQUEST,
            "The portfolio holds fewer stocks than required."
    ),

    FUND_RULE_MAX_STOCK_COUNT(
            "FUND_025",
            HttpStatus.BAD_REQUEST,
            "The portfolio holds more stocks than allowed."
    ),

    FUND_DRAFT_ALREADY_COMPLETED(
            "FUND_026",
            HttpStatus.CONFLICT,
            "This fund draft has already been completed."
    ),

    FUND_DRAFT_LOCKED(
            "FUND_027",
            HttpStatus.CONFLICT,
            "A completed fund draft can no longer be changed."
    ),

    STRESS_PORTFOLIO_NOT_AVAILABLE(
            "STRESS_001",
            HttpStatus.UNPROCESSABLE_CONTENT,
            "A selected portfolio is not available for stress testing."
    ),

    STRESS_SCENARIO_NOT_FOUND(
            "STRESS_002",
            HttpStatus.NOT_FOUND,
            "Stress scenario not found."
    ),

    STRESS_TEST_NOT_FOUND(
            "STRESS_003",
            HttpStatus.NOT_FOUND,
            "Stress test not found."
    ),
    STRESS_SCENARIO_COVERAGE_INCOMPLETE(
            "STRESS_004",
            HttpStatus.UNPROCESSABLE_CONTENT,
            "Stress scenario does not cover all assets in the selected portfolio."
    ),

    AI_ENGINE_UNAVAILABLE(
            "AI_ENGINE_001",
            HttpStatus.SERVICE_UNAVAILABLE,
            "AI Engine service is temporarily unavailable."
    ),

    AI_ENGINE_ERROR(
            "AI_ENGINE_002",
            HttpStatus.INTERNAL_SERVER_ERROR,
            "AI Engine service encountered an error."
    ),

    AI_ENGINE_INVALID_REQUEST(
            "AI_ENGINE_003",
            HttpStatus.BAD_REQUEST,
            "Invalid request to AI Engine."
    ),
    RL_PORTFOLIO_INVALID(
            "RL_001",
            HttpStatus.BAD_REQUEST,
            "Portfolio is not compatible with the RL model."
    ),
    STRESS_RL_PORTFOLIO_INVALID(
            "STRESS_005",
            HttpStatus.UNPROCESSABLE_CONTENT,
            "Portfolio is not compatible with the RL stress test model."
    ),
    STRESS_RL_SCENARIO_UNSUPPORTED(
            "STRESS_006",
            HttpStatus.UNPROCESSABLE_CONTENT,
            "Selected scenario is not supported by the RL stress test model."
    ),
    STRESS_RL_ENGINE_UNAVAILABLE(
            "STRESS_007",
            HttpStatus.SERVICE_UNAVAILABLE,
            "RL stress test service is temporarily unavailable."
    ),

    STRESS_RL_ENGINE_ERROR(
            "STRESS_008",
            HttpStatus.BAD_GATEWAY,
            "RL stress test service returned an unexpected error."
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
