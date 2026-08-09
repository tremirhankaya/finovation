package com.infina.portfoliomanagement.optimization.dto;

import com.infina.portfoliomanagement.fund.enums.FundType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record OptimizableFundResponse(
        UUID id,
        String name,
        FundType type,
        boolean active,
        LocalDate lastOptimizationDate,
        int stockCount,
        int sectorCount,
        BigDecimal equityWeightPercent,
        BigDecimal tppWeightPercent
) {
}
