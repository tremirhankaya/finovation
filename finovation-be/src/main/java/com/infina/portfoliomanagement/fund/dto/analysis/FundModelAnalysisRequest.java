package com.infina.portfoliomanagement.fund.dto.analysis;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.infina.portfoliomanagement.fund.enums.InvestmentHorizon;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FundModelAnalysisRequest(

        @NotNull
        @JsonProperty("horizon")
        InvestmentHorizon horizon,

        @NotNull
        @JsonProperty("min_stock_count")
        Integer minStockCount,

        @NotNull
        @JsonProperty("max_stock_count")
        Integer maxStockCount,

        @NotNull
        @JsonProperty("tpp_min_weight")
        BigDecimal tppMinWeight,

        @NotNull
        @JsonProperty("tpp_max_weight")
        BigDecimal tppMaxWeight,

        @NotNull
        @JsonProperty("mandatory_assets")
        List<String> mandatoryAssets,

        @NotNull
        @JsonProperty("excluded_assets")
        List<String> excludedAssets
) {
}
