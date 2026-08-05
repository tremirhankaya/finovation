package com.infina.portfoliomanagement.fund.dto;

import java.math.BigDecimal;

public record FundDraftLimitsResponse(
        BigDecimal minInitialPortfolioSize,
        BigDecimal maxInitialPortfolioSize
) {
}
