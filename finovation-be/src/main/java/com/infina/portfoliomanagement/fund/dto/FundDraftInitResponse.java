package com.infina.portfoliomanagement.fund.dto;

import java.math.BigDecimal;
import java.util.List;

public record FundDraftInitResponse(
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
        BigDecimal sectorMaxPct
) {
}
