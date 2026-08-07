package com.infina.portfoliomanagement.optimization.engine;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

@Component
public class StubOptimizationEngineClient implements OptimizationEngineClient {

    @Override
    public OptimizationEngineResult run(OptimizationEngineRequest request) {
        throw new BaseException(
                ErrorCode.EXTERNAL_SERVICE_ERROR,
                "The optimization engine is not connected yet."
        );
    }
}
