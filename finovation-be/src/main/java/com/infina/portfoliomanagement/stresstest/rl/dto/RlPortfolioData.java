package com.infina.portfoliomanagement.stresstest.rl.dto;

import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioPosition;

import java.math.BigDecimal;
import java.util.List;

public record RlPortfolioData(
        FundPortfolio fundPortfolio,
        BigDecimal initialNav,
        List<StressPortfolioPosition> positions
) {
}