package com.infina.portfoliomanagement.fund.dto.analysis;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record FundModelAssetDto(
        @JsonProperty("asset_code")
        String assetCode,

        @JsonProperty("weight")
        BigDecimal weight,

        @JsonProperty("ai_note")
        String aiNote
) {
}
