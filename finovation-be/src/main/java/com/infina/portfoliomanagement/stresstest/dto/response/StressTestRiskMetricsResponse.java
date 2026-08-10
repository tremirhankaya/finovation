package com.infina.portfoliomanagement.stresstest.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record StressTestRiskMetricsResponse(
        BigDecimal finalImpact,
        BigDecimal maxDrawdown,
        LocalDate maxDrawdownDate,
        BigDecimal worstImpact,
        LocalDate worstDate,
        BigDecimal recoveryFromTrough
) {
}