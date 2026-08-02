package com.infina.portfoliomanagement.marketdata.ingest.tpporan.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TppOranRecord(
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("issue_date") LocalDate issueDate,
        @JsonProperty("trading_volume_TR") BigDecimal tradingVolumeTr,
        @JsonProperty("transaction_count") Integer transactionCount,
        @JsonProperty("low_rate") BigDecimal lowRate,
        @JsonProperty("weighted_average") BigDecimal weightedAverage,
        @JsonProperty("close_rate") BigDecimal closeRate,
        @JsonProperty("maturity_date") LocalDate maturityDate,
        @JsonProperty("day") String day,
        @JsonProperty("open_rate") BigDecimal openRate,
        @JsonProperty("high_rate") BigDecimal highRate
) {

    public static TppOranRecord filledRate(LocalDate date, BigDecimal weightedAverage) {
        return new TppOranRecord(date, null, null, null, null, weightedAverage, null, null, null, null, null);
    }
}
