package com.infina.portfoliomanagement.stresstest.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record StressTestPortfolioPathPointResponse(
        LocalDate date,
        Short dayIndex,
        BigDecimal portfolioImpact
) {
}