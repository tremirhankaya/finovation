package com.infina.portfoliomanagement.fundmonitoring.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record FundMonitoringResponse(
        FundSummaryResponse fund,
        LocalDate asOfDate,
        String currency,
        BigDecimal outstandingShares,
        BigDecimal currentSharePrice,
        BigDecimal dailyChangePercentage,
        Map<String, List<PricePointResponse>> priceHistory,
        List<TechnicalIndicatorResponse> technicalIndicators,
        List<PeriodReturnResponse> periodReturns,
        List<FundPositionResponse> positions,
        List<SectorAllocationResponse> sectorAllocations
) {
    public record PricePointResponse(LocalDate date, BigDecimal value) {
    }

    public record TechnicalIndicatorResponse(
            String code,
            String label,
            BigDecimal value,
            String unit,
            String tone
    ) {
    }

    public record PeriodReturnResponse(
            String period,
            String label,
            BigDecimal value
    ) {
    }

    public record FundPositionResponse(
            String assetId,
            String symbol,
            String name,
            String sectorName,
            BigDecimal weightPercentage
    ) {
    }

    public record SectorAllocationResponse(
            String sectorId,
            String sectorName,
            BigDecimal weightPercentage
    ) {
    }
}
