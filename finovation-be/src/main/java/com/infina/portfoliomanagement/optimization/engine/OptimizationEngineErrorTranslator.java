package com.infina.portfoliomanagement.optimization.engine;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;

public final class OptimizationEngineErrorTranslator {

    private OptimizationEngineErrorTranslator() {
    }

    public static BaseException translate(String engineErrorCode, String engineErrorMessage) {
        ErrorCode errorCode = switch (engineErrorCode) {
            case "MANDATORY_EXCLUDED_OVERLAP", "LOCKED_EXCLUDED_OVERLAP" ->
                    ErrorCode.OPT_ASSET_PREFERENCE_CONFLICT;
            case "MAX_ADDITIONS_CONSTRAINT_CONFLICT" -> ErrorCode.OPT_MAX_ADDITIONS_EXCEEDED;
            case "MAX_REMOVALS_CONSTRAINT_CONFLICT" -> ErrorCode.OPT_MAX_REMOVALS_EXCEEDED;
            case "MAX_WEIGHT_CHANGE_CONSTRAINT_CONFLICT" -> ErrorCode.OPT_WEIGHT_CHANGE_LIMIT_EXCEEDED;
            case "INFEASIBLE_OPTIMIZE", "INFEASIBLE_CREATE" -> ErrorCode.OPT_CONSTRAINT_SET_INFEASIBLE;
            case "STOCK_COUNT_OUT_OF_RANGE", "TPP_RANGE_OUT_OF_RANGE" -> ErrorCode.OPT_INVALID_CONSTRAINT_VALUE;
            case "UNKNOWN_ASSET" -> ErrorCode.OPT_ASSET_NOT_IN_UNIVERSE;
            default -> ErrorCode.EXTERNAL_SERVICE_ERROR;
        };

        return new BaseException(errorCode, engineErrorMessage);
    }
}
