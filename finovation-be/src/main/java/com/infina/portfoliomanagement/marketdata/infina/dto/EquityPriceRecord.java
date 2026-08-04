package com.infina.portfoliomanagement.marketdata.infina.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record EquityPriceRecord(
        @JsonProperty("asset_code") String assetCode,
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("open_price") BigDecimal openPrice,
        @JsonProperty("high_price") BigDecimal highPrice,
        @JsonProperty("low_price") BigDecimal lowPrice,
        @JsonProperty("close_price") BigDecimal closePrice,
        @JsonProperty("record_date") LocalDateTime recordDate
) {

    private static final int PERSISTED_PRICE_SCALE = 8;

    public EquityPriceRecord {
        openPrice = toPersistedScale(openPrice);
        highPrice = toPersistedScale(highPrice);
        lowPrice = toPersistedScale(lowPrice);
        closePrice = toPersistedScale(closePrice);
    }

    private static BigDecimal toPersistedScale(BigDecimal price) {
        if (price == null) {
            return null;
        }

        return price.setScale(PERSISTED_PRICE_SCALE, RoundingMode.HALF_UP);
    }
}
