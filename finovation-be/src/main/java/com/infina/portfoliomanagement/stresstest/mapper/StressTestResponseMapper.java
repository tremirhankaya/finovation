package com.infina.portfoliomanagement.stresstest.mapper;

import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressAssetResult;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressTestResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.RunStressTestResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestAssetResponse;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class StressTestResponseMapper {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    public RunStressTestResponse toResponse(
            StressTest stressTest,
            StressScenario scenario,
            StressPortfolioSnapshot portfolio,
            AiStressTestResponse aiResponse
    ) {
        Map<String, AiStressAssetResult> resultsByAssetCode =
                aiResponse.assetResults()
                        .stream()
                        .collect(Collectors.toMap(
                                AiStressAssetResult::assetCode,
                                Function.identity()
                        ));

        List<StressTestAssetResponse> assets = portfolio.positions()
                .stream()
                .map(position -> {
                    AiStressAssetResult result =
                            resultsByAssetCode.get(position.assetCode());

                    BigDecimal normalizedWeight = position.weight()
                            .divide(ONE_HUNDRED, 8, RoundingMode.HALF_UP);

                    BigDecimal contribution =
                            normalizedWeight.multiply(result.impact());

                    return new StressTestAssetResponse(
                            position.assetCode(),
                            position.assetType(),
                            position.weight(),
                            result.impact(),
                            contribution
                    );
                })
                .toList();

        return new RunStressTestResponse(
                stressTest.getPublicId(),
                scenario.getCode(),
                scenario.getName(),
                stressTest.getAsOfDate(),
                aiResponse.portfolioImpact(),
                assets
        );
    }
}