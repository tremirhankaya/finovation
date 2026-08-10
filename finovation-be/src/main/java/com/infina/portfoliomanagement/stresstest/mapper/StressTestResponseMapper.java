package com.infina.portfoliomanagement.stresstest.mapper;

import com.infina.portfoliomanagement.stresstest.dto.StressAssetImpact;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.StressTestComputationResult;
import com.infina.portfoliomanagement.stresstest.dto.response.RunStressTestResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestAssetResponse;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class StressTestResponseMapper {

    public RunStressTestResponse toResponse(
            StressTest stressTest,
            StressScenario scenario,
            StressPortfolioSnapshot portfolio,
            StressTestComputationResult result
    ) {
        Map<Long, StressAssetImpact> impactsByAssetId =
                result.assetImpacts()
                        .stream()
                        .collect(Collectors.toMap(
                                StressAssetImpact::assetId,
                                Function.identity()
                        ));

        var assets = portfolio.positions()
                .stream()
                .map(position -> {
                    StressAssetImpact impact =
                            impactsByAssetId.get(position.assetId());

                    return new StressTestAssetResponse(
                            position.assetCode(),
                            position.assetType(),
                            position.weight(),
                            impact.impact(),
                            impact.portfolioContribution()
                    );
                })
                .toList();

        return new RunStressTestResponse(
                stressTest.getPublicId(),
                scenario.getCode(),
                scenario.getName(),
                stressTest.getAsOfDate(),
                result.portfolioImpact(),
                assets
        );
    }
}