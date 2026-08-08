package com.infina.portfoliomanagement.optimization.dto;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.optimization.enums.ResultActionType;

import java.math.BigDecimal;

public record OptimizationResultAssetResponse(
        String assetCode,
        String name,
        String sectorName,
        AssetType assetType,
        BigDecimal currentWeight,
        BigDecimal proposedWeight,
        BigDecimal finalWeight,
        BigDecimal changeAmount,
        ResultActionType actionType,
        boolean manuallyOverridden,
        String rationale
) {
}
