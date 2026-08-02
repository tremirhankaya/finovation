package com.infina.portfoliomanagement.marketdata.ingest.hissefiyat.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

public record StockPriceRecord(
        @JsonProperty("asset_code") String assetCode,
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("open_price") BigDecimal openPrice,
        @JsonProperty("high_price") BigDecimal highPrice,
        @JsonProperty("low_price") BigDecimal lowPrice,
        @JsonProperty("close_price") BigDecimal closePrice
) {
}
