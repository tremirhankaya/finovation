package com.infina.portfoliomanagement.stresstest.mapper;

import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressTestRequest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class StressTestAiRequestMapper {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    public AiStressTestRequest toRequest(
            String requestId,
            LocalDate asOfDate,
            String scenarioCode,
            StressPortfolioSnapshot portfolio
    ) {
        return new AiStressTestRequest(
                requestId,
                asOfDate,
                scenarioCode,
                toPortfolioMap(portfolio)
        );
    }

    private Map<String, BigDecimal> toPortfolioMap(
            StressPortfolioSnapshot portfolio
    ) {
        Map<String, BigDecimal> positions = new LinkedHashMap<>();

        portfolio.positions().forEach(position ->
                positions.put(
                        position.assetCode(),
                        position.weight()
                                .divide(ONE_HUNDRED, 8, RoundingMode.HALF_UP)
                )
        );

        return positions;
    }
}