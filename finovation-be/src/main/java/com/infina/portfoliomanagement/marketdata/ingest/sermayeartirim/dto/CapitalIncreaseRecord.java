package com.infina.portfoliomanagement.marketdata.ingest.sermayeartirim.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single corporate action event (bonus share issue, cash dividend, or rights issue)
 * for a ticker. {@code bonus}, {@code dividend} and {@code right} are percentages —
 * exactly one is normally non-zero per event, identifying which kind of action it was.
 * {@code ratio} is the resulting price-adjustment multiplier.
 */
public record CapitalIncreaseRecord(
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("code") String code,
        @JsonProperty("bonus") BigDecimal bonus,
        @JsonProperty("dividend") BigDecimal dividend,
        @JsonProperty("right") BigDecimal right,
        @JsonProperty("ratio") BigDecimal ratio,
        @JsonProperty("status") Integer status
) {
}
