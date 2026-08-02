package com.infina.portfoliomanagement.marketdata.ingest.dovizfiyat.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.infina.portfoliomanagement.marketdata.client.LenientLocalDateTimeDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record ForexRateRecord(
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("asset_code") String assetCode,
        @JsonProperty("asset_name") String assetName,
        @JsonProperty("bid") BigDecimal bid,
        @JsonProperty("ask") BigDecimal ask,
        @JsonProperty("market_code") String marketCode,
        @JsonProperty("record_id") String recordId,
        @JsonProperty("record_date")
        @JsonDeserialize(using = LenientLocalDateTimeDeserializer.class)
        LocalDateTime recordDate
) {
}
