package com.infina.portfoliomanagement.marketdata.infina.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TppRateRecord(
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("maturity_date") LocalDate maturityDate,
        @JsonProperty("open_rate") BigDecimal openRate,
        @JsonProperty("high_rate") BigDecimal highRate,
        @JsonProperty("low_rate") BigDecimal lowRate,
        @JsonProperty("close_rate") BigDecimal closeRate,
        @JsonProperty("weighted_average") BigDecimal weightedAverageRate,
        @JsonProperty("trading_volume_TR") BigDecimal tradingVolume,
        @JsonProperty("transaction_count") Integer transactionCount
) {
}
