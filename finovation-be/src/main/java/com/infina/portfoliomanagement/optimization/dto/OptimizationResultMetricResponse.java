package com.infina.portfoliomanagement.optimization.dto;

import java.math.BigDecimal;

public record OptimizationResultMetricResponse(
        String key,
        BigDecimal currentValue,
        BigDecimal proposedValue
) {
}
