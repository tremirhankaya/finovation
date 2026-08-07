package com.infina.portfoliomanagement.stresstest.dto.ai;


import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

public record AiStressTestResponse(

        @JsonProperty("request_id")
        String requestId,

        @JsonProperty("portfolio_impact")
        BigDecimal portfolioImpact,

        @JsonProperty("asset_results")
        List<AiStressAssetResult> assetResults

) {
}