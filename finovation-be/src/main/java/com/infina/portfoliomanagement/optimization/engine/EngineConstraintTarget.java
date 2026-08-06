package com.infina.portfoliomanagement.optimization.engine;

import com.infina.portfoliomanagement.optimization.enums.OptimizationConstraintCode;

import java.math.BigDecimal;

public record EngineConstraintTarget(
        OptimizationConstraintCode code,
        BigDecimal minValue,
        BigDecimal maxValue
) {
}
