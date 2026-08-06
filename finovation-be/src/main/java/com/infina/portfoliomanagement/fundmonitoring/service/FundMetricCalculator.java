package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.PeriodReturnResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.TechnicalIndicatorResponse;
import com.infina.portfoliomanagement.fundmonitoring.model.ComparisonPeriod;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationPoint;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

@Component
public class FundMetricCalculator {

    private static final double TRADING_DAYS_PER_YEAR = 252.0;
    private static final double ZERO_TOLERANCE = 1.0e-12;
    private static final int METRIC_SCALE = 4;
    private static final String UNIT_PERCENT = "PERCENT";
    private static final String TONE_NEUTRAL = "neutral";

    public BigDecimal dailyChange(List<FundValuationPoint> points) {
        if (points.size() < 2) {
            return BigDecimal.ZERO.setScale(METRIC_SCALE);
        }

        return percentageChange(
                points.get(points.size() - 2).sharePrice(),
                points.getLast().sharePrice()
        );
    }

    public List<PeriodReturnResponse> periodReturns(
            List<FundValuationPoint> points,
            LocalDate asOfDate
    ) {
        return List.of(
                periodReturn("1M", "1 Aylık Getiri", points, asOfDate.minusMonths(1)),
                periodReturn("3M", "3 Aylık Getiri", points, asOfDate.minusMonths(3)),
                periodReturn("6M", "6 Aylık Getiri", points, asOfDate.minusMonths(6))
        );
    }

    public List<TechnicalIndicatorResponse> technicalIndicators(
            List<FundValuationPoint> points,
            NavigableMap<LocalDate, BigDecimal> benchmarkValues,
            BigDecimal annualRiskFreeRate,
            BigDecimal sectorConcentration,
            BigDecimal liquidityRatio
    ) {
        BigDecimal volatility = annualizedVolatility(points);
        BigDecimal maximumDrawdown = maximumDrawdown(points);
        BigDecimal beta = beta(points, benchmarkValues);
        BigDecimal sharpeRatio = sharpeRatio(points, annualRiskFreeRate);

        return List.of(
                indicator("VOLATILITY", "Volatilite (Yıllık)", volatility,
                        UNIT_PERCENT, TONE_NEUTRAL),
                indicator("MAX_DRAWDOWN", "Maksimum Düşüş", maximumDrawdown,
                        UNIT_PERCENT, maximumDrawdown == null ? TONE_NEUTRAL : "negative"),
                indicator("BETA", "Beta", beta, "RATIO", TONE_NEUTRAL),
                indicator("SHARPE", "Sharpe Oranı", sharpeRatio, "RATIO",
                        metricTone(sharpeRatio)),
                indicator("SECTOR_CONCENTRATION", "Sektörel Yoğunluk", sectorConcentration,
                        UNIT_PERCENT, TONE_NEUTRAL),
                indicator("LIQUIDITY_RATIO", "Likidite Oranı", liquidityRatio,
                        UNIT_PERCENT, liquidityRatio.signum() > 0 ? "positive" : TONE_NEUTRAL)
        );
    }

    public Map<String, BigDecimal> comparisonReturns(
            List<FundValuationPoint> points,
            LocalDate asOfDate
    ) {
        NavigableMap<LocalDate, BigDecimal> values = new TreeMap<>();
        points.forEach(point -> values.put(point.date(), point.sharePrice()));
        return comparisonReturns(values, asOfDate);
    }

    public Map<String, BigDecimal> comparisonReturns(
            NavigableMap<LocalDate, BigDecimal> values,
            LocalDate asOfDate
    ) {
        Map<String, BigDecimal> returns = new LinkedHashMap<>();
        Map.Entry<LocalDate, BigDecimal> end = values.floorEntry(asOfDate);

        for (ComparisonPeriod period : ComparisonPeriod.values()) {
            Map.Entry<LocalDate, BigDecimal> start = values.floorEntry(
                    period.startDate(asOfDate)
            );
            BigDecimal value = start == null || end == null
                    ? null
                    : percentageChange(start.getValue(), end.getValue());
            returns.put(period.code(), value);
        }

        return Collections.unmodifiableMap(returns);
    }

    public BigDecimal annualizedVolatility(List<FundValuationPoint> points) {
        List<Double> returns = dailyReturns(points);
        if (returns.size() < 2) {
            return null;
        }

        double annualizedPercentage = sampleStandardDeviation(returns)
                * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;

        return metric(annualizedPercentage);
    }

    public BigDecimal beta(
            List<FundValuationPoint> points,
            NavigableMap<LocalDate, BigDecimal> benchmarkValues
    ) {
        Map<LocalDate, Double> fundReturns = datedDailyReturns(points);
        Map<LocalDate, Double> benchmarkReturns = datedDailyReturns(benchmarkValues);
        List<Double> alignedFundReturns = new ArrayList<>();
        List<Double> alignedBenchmarkReturns = new ArrayList<>();

        for (Map.Entry<LocalDate, Double> fundReturn : fundReturns.entrySet()) {
            Double benchmarkReturn = benchmarkReturns.get(fundReturn.getKey());
            if (benchmarkReturn != null) {
                alignedFundReturns.add(fundReturn.getValue());
                alignedBenchmarkReturns.add(benchmarkReturn);
            }
        }

        if (alignedFundReturns.size() < 2) {
            return null;
        }

        double fundMean = mean(alignedFundReturns);
        double benchmarkMean = mean(alignedBenchmarkReturns);
        double covariance = 0;
        double benchmarkVariance = 0;

        for (int index = 0; index < alignedFundReturns.size(); index++) {
            double fundDeviation = alignedFundReturns.get(index) - fundMean;
            double benchmarkDeviation = alignedBenchmarkReturns.get(index)
                    - benchmarkMean;
            covariance += fundDeviation * benchmarkDeviation;
            benchmarkVariance += benchmarkDeviation * benchmarkDeviation;
        }

        if (benchmarkVariance <= 0.0) {
            return null;
        }
        if (benchmarkVariance < ZERO_TOLERANCE) {
            return null;
        }
        return metric(covariance / benchmarkVariance);
    }

    public BigDecimal sharpeRatio(
            List<FundValuationPoint> points,
            BigDecimal annualRiskFreeRate
    ) {
        List<Double> returns = dailyReturns(points);
        if (returns.size() < 2 || annualRiskFreeRate == null) {
            return null;
        }

        double dailyStandardDeviation = sampleStandardDeviation(returns);
        if (dailyStandardDeviation <= 0.0) {
            return null;
        }
        if (dailyStandardDeviation < ZERO_TOLERANCE) {
            return null;
        }

        double annualizedExcessReturn = mean(returns) * TRADING_DAYS_PER_YEAR
                - annualRiskFreeRate.doubleValue() / 100;
        double annualizedStandardDeviation = dailyStandardDeviation
                * Math.sqrt(TRADING_DAYS_PER_YEAR);
        return metric(annualizedExcessReturn / annualizedStandardDeviation);
    }

    public BigDecimal maximumDrawdown(List<FundValuationPoint> points) {
        if (points.size() < 2) {
            return null;
        }

        double peak = points.getFirst().sharePrice().doubleValue();
        double worstDrawdown = 0;

        for (FundValuationPoint point : points) {
            double value = point.sharePrice().doubleValue();
            peak = Math.max(peak, value);
            worstDrawdown = Math.min(worstDrawdown, (value / peak - 1) * 100);
        }

        return metric(worstDrawdown);
    }

    private PeriodReturnResponse periodReturn(
            String period,
            String label,
            List<FundValuationPoint> points,
            LocalDate targetDate
    ) {
        FundValuationPoint start = null;

        for (FundValuationPoint point : points) {
            if (point.date().isAfter(targetDate)) {
                break;
            }
            start = point;
        }

        BigDecimal value = start == null
                ? null
                : percentageChange(start.sharePrice(), points.getLast().sharePrice());
        return new PeriodReturnResponse(period, label, value);
    }

    private List<Double> dailyReturns(List<FundValuationPoint> points) {
        return new ArrayList<>(datedDailyReturns(points).values());
    }

    private NavigableMap<LocalDate, Double> datedDailyReturns(
            List<FundValuationPoint> points
    ) {
        NavigableMap<LocalDate, BigDecimal> values = new TreeMap<>();
        points.forEach(point -> values.put(point.date(), point.sharePrice()));
        return datedDailyReturns(values);
    }

    private NavigableMap<LocalDate, Double> datedDailyReturns(
            NavigableMap<LocalDate, BigDecimal> values
    ) {
        NavigableMap<LocalDate, Double> returns = new TreeMap<>();
        Map.Entry<LocalDate, BigDecimal> previous = null;

        for (Map.Entry<LocalDate, BigDecimal> current : values.entrySet()) {
            if (previous != null && previous.getValue().signum() != 0) {
                returns.put(
                        current.getKey(),
                        current.getValue().doubleValue()
                                / previous.getValue().doubleValue() - 1
                );
            }
            previous = current;
        }

        return returns;
    }

    private double mean(List<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private double sampleStandardDeviation(List<Double> values) {
        double average = mean(values);
        double variance = values.stream()
                .mapToDouble(value -> Math.pow(value - average, 2))
                .sum() / (values.size() - 1);
        return Math.sqrt(variance);
    }

    private String metricTone(BigDecimal value) {
        if (value == null || value.signum() == 0) {
            return TONE_NEUTRAL;
        }
        return value.signum() > 0 ? "positive" : "negative";
    }

    private BigDecimal percentageChange(BigDecimal start, BigDecimal end) {
        if (start.signum() == 0) {
            return null;
        }

        return end.subtract(start)
                .multiply(BigDecimal.valueOf(100))
                .divide(start, METRIC_SCALE, RoundingMode.HALF_UP);
    }

    private TechnicalIndicatorResponse indicator(
            String code,
            String label,
            BigDecimal value,
            String unit,
            String tone
    ) {
        return new TechnicalIndicatorResponse(code, label, value, unit, tone);
    }

    private BigDecimal metric(double value) {
        return BigDecimal.valueOf(value).setScale(METRIC_SCALE, RoundingMode.HALF_UP);
    }
}

