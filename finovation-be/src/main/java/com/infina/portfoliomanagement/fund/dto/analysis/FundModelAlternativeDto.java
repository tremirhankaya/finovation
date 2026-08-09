package com.infina.portfoliomanagement.fund.dto.analysis;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FundModelAlternativeDto(

        @JsonProperty("objective_id")
        String objectiveId,

        @JsonProperty("horizon")
        String horizon,

        /** Asset code → decimal weight (0–1). e.g. {"GARAN.E": 0.045, "CASH_TPP": 0.10} */
        @JsonProperty("weights")
        Map<String, Double> weights,

        @JsonProperty("stock_count")
        Integer stockCount,

        @JsonProperty("equity_weight")
        Double equityWeight,

        @JsonProperty("tpp_weight")
        Double tppWeight,

        @JsonProperty("horizon_volatility")
        Double horizonVolatility,

        @JsonProperty("universe58_beta")
        Double universe58Beta,

        @JsonProperty("sector_exposures")
        Map<String, Double> sectorExposures,

        @JsonProperty("large_position_assets")
        List<String> largePositionAssets,

        @JsonProperty("large_position_total_weight")
        Double largePositionTotalWeight,

        @JsonProperty("objective_value")
        Double objectiveValue,

        @JsonProperty("reason_codes")
        Map<String, List<String>> reasonCodes,

        @JsonProperty("reason_texts")
        Map<String, List<String>> reasonTexts
) {
}
