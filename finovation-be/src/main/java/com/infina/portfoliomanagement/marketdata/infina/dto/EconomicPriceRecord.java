package com.infina.portfoliomanagement.marketdata.infina.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

@JsonIgnoreProperties(ignoreUnknown = true)
public record EconomicPriceRecord(
        @JsonProperty("asset_code") String assetCode,
        @JsonProperty("asset_name") String assetName,
        @JsonProperty("period") String period,
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("price") BigDecimal price
) {
}
