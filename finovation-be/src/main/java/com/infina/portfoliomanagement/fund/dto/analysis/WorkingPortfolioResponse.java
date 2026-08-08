package com.infina.portfoliomanagement.fund.dto.analysis;

import java.math.BigDecimal;
import java.util.List;

public record WorkingPortfolioResponse(
        Integer sourceRank,
        String label,
        List<FundPositionResponse> assets,
        BigDecimal equityWeightPct,
        BigDecimal tppWeightPct,
        Integer stockCount,
        Integer sectorCount
) {
}


