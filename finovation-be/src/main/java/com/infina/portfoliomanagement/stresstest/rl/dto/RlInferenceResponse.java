package com.infina.portfoliomanagement.stresstest.rl.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record RlInferenceResponse(
        String model,
        String scenario,

        @JsonProperty("scenario_start_date")
        LocalDate scenarioStartDate,

        @JsonProperty("scenario_end_date")
        LocalDate scenarioEndDate,

        @JsonProperty("trading_day_count")
        int tradingDayCount,

        @JsonProperty("initial_nav")
        BigDecimal initialNav,

        List<RlInferenceDay> days,

        @JsonProperty("final_nav")
        BigDecimal finalNav,

        @JsonProperty("return_pct")
        BigDecimal returnPct,

        @JsonProperty("passive_final_nav")
        BigDecimal passiveFinalNav,

        @JsonProperty("passive_return_pct")
        BigDecimal passiveReturnPct,

        @JsonProperty("outperformance_amount")
        BigDecimal outperformanceAmount,

        @JsonProperty("outperformance_pct")
        BigDecimal outperformancePct,

        @JsonProperty("total_commission")
        BigDecimal totalCommission
) {
}