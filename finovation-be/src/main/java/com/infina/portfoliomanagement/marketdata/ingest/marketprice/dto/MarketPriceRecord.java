package com.infina.portfoliomanagement.marketdata.ingest.marketprice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.infina.portfoliomanagement.marketdata.client.LenientLocalDateTimeDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record MarketPriceRecord(
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("asset_code") String assetCode,
        @JsonProperty("vendor") String vendor,
        @JsonProperty("vendor_code") String vendorCode,
        @JsonProperty("currency") String currency,
        @JsonProperty("open_price") BigDecimal openPrice,
        @JsonProperty("high_price") BigDecimal highPrice,
        @JsonProperty("low_price") BigDecimal lowPrice,
        @JsonProperty("close_price") BigDecimal closePrice,
        @JsonProperty("record_date")
        @JsonDeserialize(using = LenientLocalDateTimeDeserializer.class)
        LocalDateTime recordDate
) {
}
