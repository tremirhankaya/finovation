package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationPoint;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FundMetricCalculatorTest {

    private final FundMetricCalculator calculator = new FundMetricCalculator();

    @Test
    void returnAndDrawdown_useHistoricalSharePriceSeries() {
        LocalDate asOf = LocalDate.of(2026, 8, 4);
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
                point(LocalDate.of(2026, 8, 4), "50")
        );

        assertThat(calculator.annualizedVolatility(points)).isNull();
        assertThat(calculator.maximumDrawdown(points)).isNull();
        assertThat(calculator.dailyChange(points)).isEqualByComparingTo("0");
        assertThat(calculator.periodReturns(points, points.getFirst().date()))
                .allMatch(item -> item.value() == null);
    }

    private FundValuationPoint point(LocalDate date, String sharePrice) {
        BigDecimal price = new BigDecimal(sharePrice);
        return new FundValuationPoint(date, price.multiply(BigDecimal.TEN), price);
    }
}

