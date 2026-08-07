package com.infina.portfoliomanagement.stresstest.dto;

import com.infina.portfoliomanagement.common.enums.AssetType;

import java.math.BigDecimal;

public record StressPortfolioPosition(
        Long assetId,
        String assetCode,
        AssetType assetType,
        BigDecimal weight
) {
}