package com.infina.portfoliomanagement.stresstest.rl.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record RlStressTestHistoryResponse(
        UUID id,
        String model,
        String scenarioCode,
        BigDecimal initialNav,
        BigDecimal finalNav,
        BigDecimal returnPct,
        BigDecimal passiveReturnPct,
        BigDecimal outperformancePct,
        LocalDateTime createdAt
) {
}