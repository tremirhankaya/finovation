package com.infina.portfoliomanagement.marketdata.ingest.hissetanim.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record StockDefinitionRecord(
        @JsonProperty("issuer") String issuer,
        @JsonProperty("code") String code,
        @JsonProperty("security") String security,
        @JsonProperty("ticker") String ticker,
        @JsonProperty("status") String status,
        @JsonProperty("index") String index
) {
}
