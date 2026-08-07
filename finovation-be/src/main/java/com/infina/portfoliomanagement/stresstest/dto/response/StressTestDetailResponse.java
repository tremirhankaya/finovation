package com.infina.portfoliomanagement.stresstest.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record StressTestDetailResponse(
        UUID testId,
        String scenarioCode,
        String scenarioName,
        LocalDate asOfDate,
        BigDecimal portfolioImpact,
        LocalDateTime createdAt,
        List<StressTestAssetResponse> assets
) {
}