package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.TechnicalIndicatorResponse;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationPoint;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Month;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;

class FundMetricCalculatorTest {

    private static final LocalDate FIRST_DATE = LocalDate.of(2025, Month.JULY, 1);

    private final FundMetricCalculator calculator = new FundMetricCalculator();

    @Test
    void periodReturns_useHistoricalSharePriceSeries() {
        LocalDate asOf = LocalDate.of(2026, Month.AUGUST, 4);
        List<FundValuationPoint> points = List.of(
                point(asOf.minusYears(1), "80"),
                point(asOf.minusMonths(6), "100"),
                point(asOf.minusMonths(3), "120"),
                point(asOf.minusMonths(1), "90"),
                point(asOf, "110")
        );

        assertThat(calculator.periodReturns(points, asOf))
                .extracting(item -> item.value())
                .containsExactly(
                        new BigDecimal("22.2222"),
                        new BigDecimal("-8.3333"),
                        new BigDecimal("10.0000"),
                        new BigDecimal("37.5000")
                );
    }

    @Test
    void annualMetrics_useExactlyLast252ReturnObservations() {
        List<BigDecimal> returns = new ArrayList<>();
        for (int index = 0; index < 252; index++) {
            returns.add(index % 4 == 0
                    ? new BigDecimal("-0.0100")
                    : new BigDecimal("0.0060"));
        }
        List<FundValuationPoint> points = pointsFromReturns(returns);

        assertThat(points).hasSize(253);
        assertThat(calculator.annualizedVolatility(points)).isPositive();
        assertThat(calculator.maximumDrawdown(points)).isNegative();
        assertThat(calculator.downsideDeviation(points)).isPositive();
        assertThat(calculator.sortinoRatio(points)).isPositive();
    }

    @Test
    void insufficientHistory_returnsNullForAnnualMetrics() {
        List<FundValuationPoint> points = pointsFromReturns(
                java.util.Collections.nCopies(251, new BigDecimal("0.001"))
        );

        assertThat(calculator.annualizedVolatility(points)).isNull();
        assertThat(calculator.maximumDrawdown(points)).isNull();
        assertThat(calculator.sharpeRatio(points, new BigDecimal("37"))).isNull();
        assertThat(calculator.dailyChange(List.of(points.getFirst())))
                .isEqualByComparingTo("0");
    }

    @Test
    void technicalIndicators_returnsRequiredElevenIndicatorsInStableOrder() {
        List<BigDecimal> fundReturns = new ArrayList<>();
        List<BigDecimal> benchmarkReturns = new ArrayList<>();
        for (int index = 0; index < 252; index++) {
            BigDecimal benchmarkReturn = index % 2 == 0
                    ? new BigDecimal("0.004")
                    : new BigDecimal("-0.003");
            benchmarkReturns.add(benchmarkReturn);
            fundReturns.add(benchmarkReturn.multiply(new BigDecimal("1.4"))
                    .add(new BigDecimal("0.0004")));
        }
        List<FundValuationPoint> fundPoints = pointsFromReturns(fundReturns);
        NavigableMap<LocalDate, BigDecimal> benchmark = valuesFromReturns(
                benchmarkReturns
        );

        List<TechnicalIndicatorResponse> indicators = calculator.technicalIndicators(
                fundPoints,
                benchmark,
                new BigDecimal("37"),
                new BigDecimal("82.5")
        );

        assertThat(indicators).extracting(TechnicalIndicatorResponse::code)
                .containsExactly(
                        "VOLATILITY",
                        "MAX_DRAWDOWN",
                        "TRACKING_ERROR",
                        "CALMAR",
                        "INFORMATION_RATIO",
                        "LIQUIDITY_RATIO",
                        "BETA",
                        "DOWNSIDE_DEVIATION",
                        "SORTINO",
                        "SHARPE",
                        "ALPHA"
                );
        assertThat(indicators).allMatch(item -> !item.description().isBlank());
        assertThat(indicators).extracting(TechnicalIndicatorResponse::value)
                .doesNotContainNull();
    }

    @Test
    void comparisonReturns_calculatesEveryFrontendPeriodInStableOrder() {
        LocalDate asOf = LocalDate.of(2026, Month.AUGUST, 5);
        List<FundValuationPoint> points = List.of(
                point(asOf.minusYears(5), "50"),
                point(asOf.minusYears(3), "60"),
                point(asOf.minusYears(1), "80"),
                point(LocalDate.of(2025, Month.DECEMBER, 31), "90"),
                point(asOf.minusMonths(6), "100"),
                point(asOf.minusMonths(3), "110"),
                point(asOf.minusMonths(1), "120"),
                point(asOf.minusWeeks(1), "125"),
                point(asOf, "150")
        );

        Map<String, BigDecimal> returns = calculator.comparisonReturns(points, asOf);

        assertThat(returns.keySet()).containsExactly(
                "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"
        );
        assertThat(returns)
                .containsEntry("1W", new BigDecimal("20.0000"))
                .containsEntry("1M", new BigDecimal("25.0000"))
                .containsEntry("3M", new BigDecimal("36.3636"))
                .containsEntry("6M", new BigDecimal("50.0000"))
                .containsEntry("YTD", new BigDecimal("66.6667"))
                .containsEntry("1Y", new BigDecimal("87.5000"))
                .containsEntry("3Y", new BigDecimal("150.0000"))
                .containsEntry("5Y", new BigDecimal("200.0000"));
    }

    @Test
    void comparisonReturns_keepsUnavailablePeriodsAsNull() {
        LocalDate asOf = LocalDate.of(2026, Month.AUGUST, 5);
        Map<String, BigDecimal> returns = calculator.comparisonReturns(
                List.of(point(asOf.minusWeeks(1), "100"), point(asOf, "105")),
                asOf
        );

        assertThat(returns)
                .containsEntry("1W", new BigDecimal("5.0000"))
                .containsEntry("1M", null)
                .containsEntry("3M", null)
                .containsEntry("5Y", null);
    }

    @Test
    void beta_usesReturnsAlignedWithCompositeBenchmarkDates() {
        List<BigDecimal> benchmarkReturns = new ArrayList<>();
        List<BigDecimal> fundReturns = new ArrayList<>();
        for (int index = 0; index < 252; index++) {
            BigDecimal benchmarkReturn = index % 2 == 0
                    ? new BigDecimal("0.01")
                    : new BigDecimal("-0.005");
            benchmarkReturns.add(benchmarkReturn);
            fundReturns.add(benchmarkReturn.multiply(new BigDecimal("2")));
        }

        assertThat(calculator.beta(
                pointsFromReturns(fundReturns),
                valuesFromReturns(benchmarkReturns)
        )).isEqualByComparingTo("2.0000");
    }

    private List<FundValuationPoint> pointsFromReturns(List<BigDecimal> returns) {
        NavigableMap<LocalDate, BigDecimal> values = valuesFromReturns(returns);
        return values.entrySet().stream()
                .map(entry -> point(entry.getKey(), entry.getValue().toPlainString()))
                .toList();
    }

    private NavigableMap<LocalDate, BigDecimal> valuesFromReturns(
            List<BigDecimal> returns
    ) {
        NavigableMap<LocalDate, BigDecimal> values = new TreeMap<>();
        BigDecimal value = new BigDecimal("100");
        values.put(FIRST_DATE, value);
        for (int index = 0; index < returns.size(); index++) {
            value = value.multiply(BigDecimal.ONE.add(returns.get(index)))
                    .setScale(12, RoundingMode.HALF_UP);
            values.put(FIRST_DATE.plusDays(index + 1L), value);
        }
        return values;
    }

    private FundValuationPoint point(LocalDate date, String sharePrice) {
        BigDecimal price = new BigDecimal(sharePrice);
        return new FundValuationPoint(date, price.multiply(BigDecimal.TEN), price);
    }
}
