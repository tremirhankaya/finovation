package com.infina.portfoliomanagement.stresstest.repository.projection;

import com.infina.portfoliomanagement.common.enums.AssetType;

import java.math.BigDecimal;

public interface StressPortfolioPositionProjection {

    Long getPortfolioId();

    Long getAssetId();

    String getAssetCode();

    AssetType getAssetType();

    BigDecimal getWeight();
}