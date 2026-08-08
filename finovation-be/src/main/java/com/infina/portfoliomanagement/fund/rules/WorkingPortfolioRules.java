package com.infina.portfoliomanagement.fund.rules;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.fund.dto.analysis.FundPositionResponse;
import com.infina.portfoliomanagement.fund.enums.ConstraintCode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class WorkingPortfolioRules {

    private static final BigDecimal TOTAL_WEIGHT_PCT = new BigDecimal("100");

    private WorkingPortfolioRules() {
    }

    public static List<RuleViolation> validate(
            List<FundPositionResponse> positions,
            PortfolioRuleLimits limits
    ) {
        List<RuleViolation> violations = new ArrayList<>();

        checkTotalWeightViolation(violations, positions, limits.weightSumTolerancePct());

        List<FundPositionResponse> equities = filterByType(positions, AssetType.EQUITY);

        checkRangeViolations(
                violations,
                ConstraintCode.EQUITY_MIN,
                ConstraintCode.EQUITY_MAX,
                sumOf(equities),
                limits.equityMinPct(),
                limits.equityMaxPct()
        );

        checkRangeViolations(
                violations,
                ConstraintCode.TPP_MIN,
                ConstraintCode.TPP_MAX,
                sumOf(filterByType(positions, AssetType.TPP)),
                limits.tppMinPct(),
                limits.tppMaxPct()
        );

        checkSingleStockViolation(violations, equities, limits.singleStockMaxPct());
        checkAboveThresholdViolation(
                violations,
                equities,
                limits.aboveThresholdPct(),
                limits.aboveThresholdSumMax()
        );
        checkSectorViolation(violations, equities, limits.sectorMaxPct());
        checkStockCountViolations(violations, equities.size(), limits);

        return List.copyOf(violations);
    }

    private static void checkTotalWeightViolation(
            List<RuleViolation> violations,
            List<FundPositionResponse> positions,
            BigDecimal tolerance
    ) {
        BigDecimal totalWeight = sumOf(positions);
        BigDecimal allowedDrift = tolerance == null ? BigDecimal.ZERO : tolerance;

        if (totalWeight.subtract(TOTAL_WEIGHT_PCT).abs().compareTo(allowedDrift) > 0) {
            violations.add(RuleViolation.equalTo(
                    ConstraintCode.TOTAL_WEIGHT,
                    totalWeight,
                    TOTAL_WEIGHT_PCT
            ));
        }
    }

    private static void checkSingleStockViolation(
            List<RuleViolation> violations,
            List<FundPositionResponse> equities,
            BigDecimal singleStockMaxPct
    ) {
        if (singleStockMaxPct == null) {
            return;
        }
        BigDecimal heaviest = equities.stream()
                .map(FundPositionResponse::weight)
                .max(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);

        if (heaviest.compareTo(singleStockMaxPct) > 0) {
            violations.add(RuleViolation.atMost(
                    ConstraintCode.SINGLE_STOCK_MAX,
                    heaviest,
                    singleStockMaxPct
            ));
        }
    }

    private static void checkAboveThresholdViolation(
            List<RuleViolation> violations,
            List<FundPositionResponse> equities,
            BigDecimal thresholdPct,
            BigDecimal sumMaxPct
    ) {
        if (thresholdPct == null || sumMaxPct == null) {
            return;
        }
        BigDecimal aboveThresholdSum = equities.stream()
                .map(FundPositionResponse::weight)
                .filter(weight -> weight.compareTo(thresholdPct) > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (aboveThresholdSum.compareTo(sumMaxPct) > 0) {
            violations.add(RuleViolation.atMost(
                    ConstraintCode.ABOVE_THRESHOLD_SUM_MAX,
                    aboveThresholdSum,
                    sumMaxPct
            ));
        }
    }

    private static void checkSectorViolation(
            List<RuleViolation> violations,
            List<FundPositionResponse> equities,
            BigDecimal sectorMaxPct
    ) {
        if (sectorMaxPct == null) {
            return;
        }
        Map<String, BigDecimal> weightBySector = new LinkedHashMap<>();
        for (FundPositionResponse equity : equities) {
            if (equity.sectorName() == null) {
                continue;
            }
            weightBySector.merge(equity.sectorName(), equity.weight(), BigDecimal::add);
        }

        BigDecimal heaviestSector = weightBySector.values().stream()
                .max(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);

        if (heaviestSector.compareTo(sectorMaxPct) > 0) {
            violations.add(RuleViolation.atMost(
                    ConstraintCode.SECTOR_MAX,
                    heaviestSector,
                    sectorMaxPct
            ));
        }
    }

    private static void checkStockCountViolations(
            List<RuleViolation> violations,
            int stockCount,
            PortfolioRuleLimits limits
    ) {
        BigDecimal actual = BigDecimal.valueOf(stockCount);
        if (stockCount < limits.minStockCount()) {
            violations.add(RuleViolation.atLeast(
                    ConstraintCode.MIN_STOCK_COUNT,
                    actual,
                    BigDecimal.valueOf(limits.minStockCount())
            ));
        }
        if (stockCount > limits.maxStockCount()) {
            violations.add(RuleViolation.atMost(
                    ConstraintCode.MAX_STOCK_COUNT,
                    actual,
                    BigDecimal.valueOf(limits.maxStockCount())
            ));
        }
    }

    private static void checkRangeViolations(
            List<RuleViolation> violations,
            ConstraintCode minimumCode,
            ConstraintCode maximumCode,
            BigDecimal actual,
            BigDecimal minimum,
            BigDecimal maximum
    ) {
        if (minimum != null && actual.compareTo(minimum) < 0) {
            violations.add(RuleViolation.atLeast(minimumCode, actual, minimum));
        }
        if (maximum != null && actual.compareTo(maximum) > 0) {
            violations.add(RuleViolation.atMost(maximumCode, actual, maximum));
        }
    }

    private static List<FundPositionResponse> filterByType(
            List<FundPositionResponse> positions,
            AssetType assetType
    ) {
        return positions.stream()
                .filter(position -> position.assetType() == assetType)
                .toList();
    }

    private static BigDecimal sumOf(List<FundPositionResponse> positions) {
        return positions.stream()
                .map(FundPositionResponse::weight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
