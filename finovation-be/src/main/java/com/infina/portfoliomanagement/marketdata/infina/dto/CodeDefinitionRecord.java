package com.infina.portfoliomanagement.marketdata.infina.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CodeDefinitionRecord(
        @JsonProperty("asset_code") String assetCode,
        @JsonProperty("code") String code,
        @JsonProperty("asset_type") String assetType,
        @JsonProperty("issue_name") String issueName,
        @JsonProperty("security_desc") String securityDesc,
        @JsonProperty("security_type") String securityType,
        @JsonProperty("sector") String sector,
        @JsonProperty("isin_code") String isinCode,
        @JsonProperty("legacy_code") String legacyCode,
        @JsonProperty("issuer") String issuer,
        @JsonProperty("market_code") String marketCode,
        @JsonProperty("currency_code") String currencyCode,
        @JsonProperty("vendor") String vendor
) {
}
