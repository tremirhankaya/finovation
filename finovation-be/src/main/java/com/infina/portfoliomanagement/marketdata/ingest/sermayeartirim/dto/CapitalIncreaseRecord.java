package com.infina.portfoliomanagement.marketdata.ingest.sermayeartirim.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

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
