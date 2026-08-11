package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPortfolioPathPointResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestRiskMetricsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StressTestRiskService {

    private final StressTestPathService stressTestPathService;

    @Transactional(readOnly = true)
    public StressTestRiskMetricsResponse getRiskMetrics(
            String actorUsername,
            UUID testId
    ) {
        var points = stressTestPathService
                .getPortfolioPath(actorUsername, testId)
                .points();

        if (points.isEmpty()) {
            throw new BaseException(
                    ErrorCode.STRESS_SCENARIO_COVERAGE_INCOMPLETE
            );
        }

        var worstPoint = points.stream()
                .min(Comparator.comparing(
                        StressTestPortfolioPathPointResponse::portfolioImpact
                ))
                .orElseThrow();

        BigDecimal peakValue = BigDecimal.ONE;
        BigDecimal maxDrawdown = BigDecimal.ZERO;
        LocalDate maxDrawdownDate = points.getFirst().date();

        for (var point : points) {
            BigDecimal currentValue =
                    BigDecimal.ONE.add(point.portfolioImpact());

            if (currentValue.compareTo(peakValue) > 0) {
                peakValue = currentValue;
            }

            BigDecimal drawdown = currentValue
                    .divide(
                            peakValue,
                            12,
                            RoundingMode.HALF_UP
                    )
                    .subtract(BigDecimal.ONE);

            if (drawdown.compareTo(maxDrawdown) < 0) {
                maxDrawdown = drawdown;
                maxDrawdownDate = point.date();
            }
        }

        var finalPoint = points.getLast();

        BigDecimal troughValue =
                BigDecimal.ONE.add(worstPoint.portfolioImpact());

        BigDecimal finalValue =
                BigDecimal.ONE.add(finalPoint.portfolioImpact());

        BigDecimal recoveryFromTrough = finalValue
                .divide(
                        troughValue,
                        12,
                        RoundingMode.HALF_UP
                )
                .subtract(BigDecimal.ONE);

        return new StressTestRiskMetricsResponse(
                finalPoint.portfolioImpact(),
                maxDrawdown,
                maxDrawdownDate,
                worstPoint.portfolioImpact(),
                worstPoint.date(),
                recoveryFromTrough
        );
    }
}