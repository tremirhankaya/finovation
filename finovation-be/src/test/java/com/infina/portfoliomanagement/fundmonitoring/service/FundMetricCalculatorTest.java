package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationPoint;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Month;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FundMetricCalculatorTest {

    private final FundMetricCalculator calculator = new FundMetricCalculator();

    @Test
    void returnAndDrawdown_useHistoricalSharePriceSeries() {
        LocalDate asOf = LocalDate.of(2026, Month.AUGUST, 4);
        List<FundValuationPoint> points = List.of(
                point(asOf.minusMonths(6), "100"),
                point(asOf.minusMonths(3), "120"),
                point(asOf.minusMonths(1), "90"),
                point(asOf, "110")
        );

        var returns = calculator.periodReturns(points, asOf);

        assertThat(returns).extracting(item -> item.value())
                .containsExactly(
                        new BigDecimal("22.2222"),
                        new BigDecimal("-8.3333"),
                        new BigDecimal("10.0000")
                );
        assertThat(calculator.maximumDrawdown(points))
                .isEqualByComparingTo("-25.0000");
        assertThat(calculator.annualizedVolatility(points)).isPositive();
    }

    @Test
    void insufficientHistory_returnsNullForLongHorizonMetrics() {
        List<FundValuationPoint> points = List.of(
                point(LocalDate.of(2026, Month.AUGUST, 4), "50")
        );

        assertThat(calculator.annualizedVolatility(points)).isNull();
        assertThat(calculator.maximumDrawdown(points)).isNull();
        assertThat(calculator.dailyChange(points)).isEqualByComparingTo("0");
        assertThat(calculator.periodReturns(points, points.getFirst().date()))
                .allMatch(item -> item.value() == null);
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

    private FundValuationPoint point(LocalDate date, String sharePrice) {
        BigDecimal price = new BigDecimal(sharePrice);
        return new FundValuationPoint(date, price.multiply(BigDecimal.TEN), price);
    }
}

