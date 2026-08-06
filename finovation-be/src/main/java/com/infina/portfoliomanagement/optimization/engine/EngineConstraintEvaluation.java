package com.infina.portfoliomanagement.optimization.engine;

import com.infina.portfoliomanagement.optimization.enums.CheckStatus;
import com.infina.portfoliomanagement.optimization.enums.OptimizationConstraintCode;

import java.math.BigDecimal;

public record EngineConstraintEvaluation(
        OptimizationConstraintCode code,
        BigDecimal actualValue,
        CheckStatus status
) {
}
