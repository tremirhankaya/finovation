package com.infina.portfoliomanagement.stresstest.engine;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.dto.StressAssetImpact;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioPosition;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.StressTestComputationResult;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import com.infina.portfoliomanagement.stresstest.entity.StressScenarioAssetShock;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioAssetShockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class DeterministicStressTestEngine implements StressTestEngine {

    private static final BigDecimal ONE_HUNDRED =
            new BigDecimal("100");

    private final StressScenarioAssetShockRepository shockRepository;

    @Override
    public StressTestComputationResult calculate(
            StressScenario scenario,
            StressPortfolioSnapshot portfolio
    ) {
        Map<Long, StressScenarioAssetShock> shocksByAssetId =
                loadShocks(scenario.getId());

        validateCoverage(portfolio, shocksByAssetId);

        var assetImpacts = portfolio.positions()
                .stream()
                .map(position -> calculateAssetImpact(
                        position,
                        shocksByAssetId.get(position.assetId())
                ))
                .toList();

        BigDecimal portfolioImpact = assetImpacts.stream()
                .map(StressAssetImpact::portfolioContribution)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new StressTestComputationResult(
                portfolioImpact,
                assetImpacts
        );
    }

    private Map<Long, StressScenarioAssetShock> loadShocks(
            Long scenarioId
    ) {
        return shockRepository.findAllByScenarioId(scenarioId)
                .stream()
                .collect(Collectors.toMap(
                        shock -> shock.getAsset().getId(),
                        Function.identity()
                ));
    }

    private void validateCoverage(
            StressPortfolioSnapshot portfolio,
            Map<Long, StressScenarioAssetShock> shocksByAssetId
    ) {
        boolean missingShock = portfolio.positions()
                .stream()
                .map(StressPortfolioPosition::assetId)
                .anyMatch(assetId -> !shocksByAssetId.containsKey(assetId));

        if (missingShock) {
            throw new BaseException(
                    ErrorCode.STRESS_SCENARIO_COVERAGE_INCOMPLETE
            );
        }
    }

    private StressAssetImpact calculateAssetImpact(
            StressPortfolioPosition position,
            StressScenarioAssetShock shock
    ) {
        BigDecimal normalizedWeight = position.weight()
                .divide(
                        ONE_HUNDRED,
                        8,
                        RoundingMode.HALF_UP
                );

        BigDecimal contribution =
                normalizedWeight.multiply(shock.getImpact());

        return new StressAssetImpact(
                position.assetId(),
                position.assetCode(),
                shock.getImpact(),
                contribution
        );
    }
}