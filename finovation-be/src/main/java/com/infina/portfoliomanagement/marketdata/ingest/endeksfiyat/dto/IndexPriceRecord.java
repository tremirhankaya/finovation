package com.infina.portfoliomanagement.marketdata.ingest.endeksfiyat.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.infina.portfoliomanagement.marketdata.client.LenientLocalDateTimeDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record IndexPriceRecord(
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("asset_code") String assetCode,
        @JsonProperty("asset_name") String assetName,
        @JsonProperty("open_price") BigDecimal openPrice,
        @JsonProperty("high_price") BigDecimal highPrice,
        @JsonProperty("low_price") BigDecimal lowPrice,
        @JsonProperty("close_price") BigDecimal closePrice,
        @JsonProperty("close_price_TRY_BID") BigDecimal closePriceTryBid,
        @JsonProperty("close_price_TRY_ASK") BigDecimal closePriceTryAsk,
        @JsonProperty("currency") String currency,
        @JsonProperty("security_type") String securityType,
        @JsonProperty("record_id") String recordId,
        @JsonProperty("record_date")
        @JsonDeserialize(using = LenientLocalDateTimeDeserializer.class)
        LocalDateTime recordDate
) {
}
