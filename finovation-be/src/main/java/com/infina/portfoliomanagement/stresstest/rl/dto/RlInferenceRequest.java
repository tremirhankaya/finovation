package com.infina.portfoliomanagement.stresstest.rl.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.Map;

public record RlInferenceRequest(
        String model,
        String scenario,
        @JsonProperty("initial_nav")
        BigDecimal initialNav,
        @JsonProperty("initial_weights")
        Map<String, BigDecimal> initialWeights
) {
}