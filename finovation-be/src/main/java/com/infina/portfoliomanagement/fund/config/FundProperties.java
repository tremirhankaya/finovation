package com.infina.portfoliomanagement.fund.config;

import com.infina.portfoliomanagement.fund.entity.FundDesignProfile;

import java.math.BigDecimal;

public record FundProperties(
        BigDecimal minInitialPortfolioSize,
        BigDecimal maxInitialPortfolioSize,
        BigDecimal minUnitPrice,
        BigDecimal maxUnitPrice,
        int minLiquidityTargetPct,
        int maxLiquidityTargetPct,
        int minStockCount,
        int maxStockCount,
        int minSingleStockMaxPct,
        int maxSingleStockMaxPct,
        int minEquityWeightPct,
        int maxEquityWeightPct,
        BigDecimal sectorMaxPct,
        int minTppRangePct,
        int minStockCountRange,
        BigDecimal aboveThresholdPct,
        BigDecimal aboveThresholdSumMax,
        BigDecimal weightSumTolerancePct,
        int maxAssetPreferences
) {
    public static FundProperties from(FundDesignProfile profile) {
        return new FundProperties(
                profile.getMinInitialPortfolioSize(),
                profile.getMaxInitialPortfolioSize(),
                profile.getMinUnitPrice(),
                profile.getMaxUnitPrice(),
                profile.getMinLiquidityTargetPct(),
                profile.getMaxLiquidityTargetPct(),
                profile.getMinStockCount(),
                profile.getMaxStockCount(),
                profile.getMinSingleStockMaxPct(),
                profile.getMaxSingleStockMaxPct(),
                profile.getMinEquityWeightPct(),
                profile.getMaxEquityWeightPct(),
                profile.getSectorMaxPct(),
                profile.getMinTppRangePct(),
                profile.getMinStockCountRange(),
                profile.getAboveThresholdPct(),
                profile.getAboveThresholdSumMax(),
                profile.getWeightSumTolerancePct(),
                profile.getMaxAssetPreferences()
        );
    }
}
