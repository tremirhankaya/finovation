package com.infina.portfoliomanagement.fund.rules;

import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.entity.FundDraft;

import java.math.BigDecimal;

public record PortfolioRuleLimits(
        BigDecimal equityMinPct,
        BigDecimal equityMaxPct,
        BigDecimal tppMinPct,
        BigDecimal tppMaxPct,
        BigDecimal singleStockMaxPct,
        BigDecimal sectorMaxPct,
        BigDecimal aboveThresholdPct,
        BigDecimal aboveThresholdSumMax,
        BigDecimal weightSumTolerancePct,
        int minStockCount,
        int maxStockCount
) {

    public static PortfolioRuleLimits from(FundDraft draft, FundProperties profileLimits) {
        return new PortfolioRuleLimits(
                toDecimal(draft.getEquityMinPct()),
                toDecimal(draft.getEquityMaxPct()),
                toDecimal(draft.getTppMinPct()),
                toDecimal(draft.getTppMaxPct()),
                toDecimal(draft.getSingleStockMaxPct()),
                profileLimits.sectorMaxPct(),
                profileLimits.aboveThresholdPct(),
                profileLimits.aboveThresholdSumMax(),
                profileLimits.weightSumTolerancePct(),
                draft.getMinStockCount() == null ? 0 : draft.getMinStockCount().intValue(),
                draft.getMaxStockCount() == null
                        ? Integer.MAX_VALUE
                        : draft.getMaxStockCount().intValue()
        );
    }

    private static BigDecimal toDecimal(Short value) {
        return value == null ? null : BigDecimal.valueOf(value.intValue());
    }
}
