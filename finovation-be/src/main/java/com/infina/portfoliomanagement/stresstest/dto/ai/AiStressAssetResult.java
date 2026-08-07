package com.infina.portfoliomanagement.stresstest.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record AiStressAssetResult(

        @JsonProperty("asset_code")
        String assetCode,

        @JsonProperty("impact")
        BigDecimal impact

) {
}