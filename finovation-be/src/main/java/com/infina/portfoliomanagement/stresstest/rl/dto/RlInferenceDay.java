package com.infina.portfoliomanagement.stresstest.rl.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public record RlInferenceDay(
        @JsonProperty("day_number")
        int dayNumber,

        LocalDate date,

        @JsonProperty("total_new_nav")
        BigDecimal totalNewNav,

        @JsonProperty("passive_nav")
        BigDecimal passiveNav,

        Map<String, BigDecimal> weights
) {
}