package com.infina.portfoliomanagement.stresstest.dto;

import java.util.List;

public record StressPortfolioSnapshot(
        Long portfolioId,
        List<StressPortfolioPosition> positions
) {

    public StressPortfolioSnapshot {
        positions = List.copyOf(positions);
    }
}