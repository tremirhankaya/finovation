package com.infina.portfoliomanagement.fund.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.infina.portfoliomanagement.fund.enums.FundDesignInitPage;

import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FundDraftInitResponse(
        FundDesignInitPage page,
        List<FundCurrencyOption> currencies,
        String defaultCurrency,
        BigDecimal minInitialPortfolioSize,
        BigDecimal maxInitialPortfolioSize,
        BigDecimal minUnitPrice,
        BigDecimal maxUnitPrice,
        int minLiquidityTargetPct,
        int maxLiquidityTargetPct,
        int minTppRangePct,
        int minStockCount,
        int maxStockCount,
        int minStockCountRange,
        int minSingleStockMaxPct,
        int maxSingleStockMaxPct,
        int minEquityWeightPct,
        int maxEquityWeightPct,
        BigDecimal sectorMaxPct,
        BigDecimal aboveThresholdPct,
        BigDecimal aboveThresholdSumMax,
        int maxAssetPreferences,
        FundDraftResponse draft,
        List<ModelUniverseAssetResponse> modelUniverse
) {
}
