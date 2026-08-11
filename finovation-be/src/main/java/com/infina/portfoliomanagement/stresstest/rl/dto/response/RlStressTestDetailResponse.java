package com.infina.portfoliomanagement.stresstest.rl.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record RlStressTestDetailResponse(
        UUID id,
        String model,
        String scenarioCode,
        LocalDate scenarioStartDate,
        LocalDate scenarioEndDate,
        int tradingDayCount,
        BigDecimal initialNav,
        BigDecimal finalNav,
        BigDecimal returnPct,
        BigDecimal passiveFinalNav,
        BigDecimal passiveReturnPct,
        BigDecimal outperformanceAmount,
        BigDecimal outperformancePct,
        BigDecimal totalCommission,
        LocalDateTime createdAt,
        List<RlStressTestDayResponse> days
) {
}