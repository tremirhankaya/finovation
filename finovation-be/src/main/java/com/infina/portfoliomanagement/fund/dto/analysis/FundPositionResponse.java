package com.infina.portfoliomanagement.fund.dto.analysis;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.infina.portfoliomanagement.common.enums.AssetType;

import java.math.BigDecimal;

public record FundPositionResponse(
        @JsonProperty("asset_code")
        String assetCode,

        @JsonProperty("display_name")
        String displayName,

        @JsonProperty("weight")
        BigDecimal weight,

        @JsonProperty("ai_note")
        String aiNote,

        @JsonProperty("sector_name")
        String sectorName,

        @JsonProperty("asset_type")
        AssetType assetType
) {
}
