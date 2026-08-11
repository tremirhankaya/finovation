package com.infina.portfoliomanagement.stresstest.rl.dto.response;

public record RlPortfolioCompatibilityResponse(
        boolean compatible,
        String message
) {
}