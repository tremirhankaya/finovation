package com.infina.portfoliomanagement.stresstest.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public record AiStressTestRequest(

        @JsonProperty("request_id")
        String requestId,

        @JsonProperty("as_of_date")
        LocalDate asOfDate,

        @JsonProperty("scenario_code")
        String scenarioCode,

        @JsonProperty("current_portfolio")
        Map<String, BigDecimal> currentPortfolio

) {
}