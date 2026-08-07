package com.infina.portfoliomanagement.stresstest.client;

import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressAssetResult;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressTestRequest;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressTestResponse;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Component
public class MockStressTestAiClient implements StressTestAiClient {

    private static final Map<String, BigDecimal> GLOBAL_CRISIS_IMPACTS = Map.of(
            "AKBNK.E", new BigDecimal("-0.084"),
            "ASELS.E", new BigDecimal("-0.031"),
            "BIMAS.E", new BigDecimal("-0.018"),
            "EREGL.E", new BigDecimal("-0.067"),
            "FROTO.E", new BigDecimal("-0.054"),
            "MGROS.E", new BigDecimal("-0.021"),
            "TCELL.E", new BigDecimal("-0.029"),
            "THYAO.E", new BigDecimal("-0.072"),
            "TUPRS.E", new BigDecimal("-0.049"),
            "YKBNK.E", new BigDecimal("-0.091")
    );

    private static final Map<String, BigDecimal> RATE_CUT_IMPACTS = Map.of(
            "AKBNK.E", new BigDecimal("-0.041"),
            "ASELS.E", new BigDecimal("0.012"),
            "BIMAS.E", new BigDecimal("0.009"),
            "EREGL.E", new BigDecimal("0.018"),
            "FROTO.E", new BigDecimal("0.015"),
            "MGROS.E", new BigDecimal("0.006"),
            "TCELL.E", new BigDecimal("0.010"),
            "THYAO.E", new BigDecimal("0.017"),
            "TUPRS.E", new BigDecimal("0.011"),
            "YKBNK.E", new BigDecimal("-0.038")
    );

    private static final BigDecimal GLOBAL_CRISIS_DEFAULT =
            new BigDecimal("-0.030");

    private static final BigDecimal RATE_CUT_DEFAULT =
            new BigDecimal("0.010");

    private static final BigDecimal TPP_IMPACT =
            new BigDecimal("0.002");

    @Override
    public AiStressTestResponse runStressTest(AiStressTestRequest request) {
        List<AiStressAssetResult> assetResults = request.currentPortfolio()
                .keySet()
                .stream()
                .map(assetCode -> new AiStressAssetResult(
                        assetCode,
                        resolveImpact(request.scenarioCode(), assetCode)
                ))
                .toList();

        BigDecimal portfolioImpact = calculatePortfolioImpact(
                request,
                assetResults
        );

        return new AiStressTestResponse(
                request.requestId(),
                portfolioImpact,
                assetResults
        );
    }

    private BigDecimal resolveImpact(
            String scenarioCode,
            String assetCode
    ) {
        if ("TPP1G".equals(assetCode)) {
            return TPP_IMPACT;
        }

        return switch (scenarioCode) {
            case "GLOBAL_CRISIS" ->
                    GLOBAL_CRISIS_IMPACTS.getOrDefault(
                            assetCode,
                            GLOBAL_CRISIS_DEFAULT
                    );

            case "RATE_CUT_SHOCK" ->
                    RATE_CUT_IMPACTS.getOrDefault(
                            assetCode,
                            RATE_CUT_DEFAULT
                    );

            default ->
                    throw new IllegalArgumentException(
                            "Unsupported stress scenario: " + scenarioCode
                    );
        };
    }

    private BigDecimal calculatePortfolioImpact(
            AiStressTestRequest request,
            List<AiStressAssetResult> assetResults
    ) {
        return assetResults.stream()
                .map(result -> {
                    BigDecimal weight = request.currentPortfolio()
                            .get(result.assetCode());

                    return weight.multiply(result.impact());
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}