package com.infina.portfoliomanagement.optimization.engine;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class OptimizationEngineErrorTranslatorTest {

    @ParameterizedTest
    @CsvSource({
            "MANDATORY_EXCLUDED_OVERLAP, OPT_ASSET_PREFERENCE_CONFLICT",
            "LOCKED_EXCLUDED_OVERLAP, OPT_ASSET_PREFERENCE_CONFLICT",
            "MAX_ADDITIONS_CONSTRAINT_CONFLICT, OPT_MAX_ADDITIONS_EXCEEDED",
            "MAX_REMOVALS_CONSTRAINT_CONFLICT, OPT_MAX_REMOVALS_EXCEEDED",
            "MAX_WEIGHT_CHANGE_CONSTRAINT_CONFLICT, OPT_WEIGHT_CHANGE_LIMIT_EXCEEDED",
            "INFEASIBLE_OPTIMIZE, OPT_CONSTRAINT_SET_INFEASIBLE",
            "INFEASIBLE_CREATE, OPT_CONSTRAINT_SET_INFEASIBLE",
            "STOCK_COUNT_OUT_OF_RANGE, OPT_INVALID_CONSTRAINT_VALUE",
            "TPP_RANGE_OUT_OF_RANGE, OPT_INVALID_CONSTRAINT_VALUE",
            "UNKNOWN_ASSET, OPT_ASSET_NOT_IN_UNIVERSE",
            "SNAPSHOT_MISMATCH, EXTERNAL_SERVICE_ERROR",
            "SOME_UNMAPPED_FUTURE_CODE, EXTERNAL_SERVICE_ERROR",
    })
    void translate_mapsEngineErrorCodeToExpectedErrorCode(String engineErrorCode, ErrorCode expected) {
        BaseException exception = OptimizationEngineErrorTranslator.translate(engineErrorCode, "engine message");

        assertThat(exception.getErrorCode()).isEqualTo(expected);
        assertThat(exception.getMessage()).isEqualTo("engine message");
    }
}
