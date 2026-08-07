package com.infina.portfoliomanagement.fund.dto.analysis;

public record WorkingPortfolioResponse(
        Integer sourceRank,
        String label,
        java.util.List<FundModelAssetDto> assets
) {
}
