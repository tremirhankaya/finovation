package com.infina.portfoliomanagement.stresstest.dto.response;

import com.infina.portfoliomanagement.common.enums.AssetType;

import java.math.BigDecimal;

public record StressTestAssetResponse(
        String assetCode,
        AssetType assetType,
        BigDecimal weight,
        BigDecimal impact,
        BigDecimal portfolioContribution
) {
}