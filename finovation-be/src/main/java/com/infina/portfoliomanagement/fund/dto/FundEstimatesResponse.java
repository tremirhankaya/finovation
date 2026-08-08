package com.infina.portfoliomanagement.fund.dto;

import java.math.BigDecimal;

public record FundEstimatesResponse(
        BigDecimal beta,
        BigDecimal volatilityPct,
        BigDecimal sharpeRatio,
        BigDecimal maxDrawdownPct
) {
}
