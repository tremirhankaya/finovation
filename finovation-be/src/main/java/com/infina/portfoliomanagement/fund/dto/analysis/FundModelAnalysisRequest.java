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
        Integer tppMinWeight,

        @NotNull
        @JsonProperty("tpp_max_weight")
        Integer tppMaxWeight,

        @JsonProperty("preferred_tpp_weight")
        Integer preferredTppWeight,

        @NotNull
        @JsonProperty("max_any_stock_weight")
        Integer maxAnyStockWeight,

        @NotNull
        @JsonProperty("max_sector_weight")
        BigDecimal maxSectorWeight,

        @NotNull
        @JsonProperty("equity_min_weight")
        Integer equityMinWeight,

        @NotNull
        @JsonProperty("equity_max_weight")
        Integer equityMaxWeight,

        @NotNull
        @JsonProperty("excluded_assets")
        List<String> excludedAssets,

        @JsonProperty("forced_assets")
        List<String> forcedAssets
) {
}
