package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.PeriodReturnResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.TechnicalIndicatorResponse;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationPoint;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
public class FundMetricCalculator {

    private static final double TRADING_DAYS_PER_YEAR = 252.0;
    private static final int METRIC_SCALE = 4;

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
            BigDecimal sectorConcentration,
            BigDecimal liquidityRatio
    ) {
        BigDecimal volatility = annualizedVolatility(points);
        BigDecimal maximumDrawdown = maximumDrawdown(points);

        return List.of(
                indicator("VOLATILITY", "Volatilite (Yıllık)", volatility,
                        "PERCENT", "neutral"),
                indicator("MAX_DRAWDOWN", "Maksimum Düşüş", maximumDrawdown,
                        "PERCENT", maximumDrawdown == null ? "neutral" : "negative"),
                indicator("BETA", "Beta", null, "RATIO", "neutral"),
                indicator("SHARPE", "Sharpe Oranı", null, "RATIO", "neutral"),
                indicator("SECTOR_CONCENTRATION", "Sektörel Yoğunluk", sectorConcentration,
                        "PERCENT", "neutral"),
                indicator("LIQUIDITY_RATIO", "Likidite Oranı", liquidityRatio,
                        "PERCENT", liquidityRatio.signum() > 0 ? "positive" : "neutral")
        );
    }

    public BigDecimal annualizedVolatility(List<FundValuationPoint> points) {
        List<Double> returns = dailyReturns(points);
        if (returns.size() < 2) {
            return null;
        }

        double mean = returns.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double variance = returns.stream()
                .mapToDouble(value -> Math.pow(value - mean, 2))
                .sum() / (returns.size() - 1);
        double annualizedPercentage = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;

        return metric(annualizedPercentage);
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
        List<Double> returns = new ArrayList<>();

        for (int index = 1; index < points.size(); index++) {
            double previous = points.get(index - 1).sharePrice().doubleValue();
            double current = points.get(index).sharePrice().doubleValue();
            returns.add(current / previous - 1);
        }

        return returns;
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

