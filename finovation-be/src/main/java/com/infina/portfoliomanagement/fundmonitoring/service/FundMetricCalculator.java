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

    static final int ANNUAL_RETURN_OBSERVATIONS = 252;
    private static final int ANNUAL_PRICE_OBSERVATIONS = ANNUAL_RETURN_OBSERVATIONS + 1;
    private static final double TRADING_DAYS_PER_YEAR = ANNUAL_RETURN_OBSERVATIONS;
    private static final double ZERO_TOLERANCE = 1.0e-12;
    private static final int METRIC_SCALE = 4;
    private static final String UNIT_PERCENT = "PERCENT";
    private static final String UNIT_RATIO = "RATIO";
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
                periodReturn("6M", "6 Aylık Getiri", points, asOfDate.minusMonths(6)),
                periodReturn("1Y", "1 Yıllık Getiri", points, asOfDate.minusYears(1))
        );
    }

    public List<TechnicalIndicatorResponse> technicalIndicators(
            List<FundValuationPoint> points,
            NavigableMap<LocalDate, BigDecimal> benchmarkValues,
            BigDecimal annualRiskFreeRate,
            BigDecimal liquidityRatio
    ) {
        BigDecimal volatility = annualizedVolatility(points);
        BigDecimal maximumDrawdown = maximumDrawdown(points);
        BigDecimal trackingError = trackingError(points, benchmarkValues);
        BigDecimal calmarRatio = calmarRatio(points);
        BigDecimal informationRatio = informationRatio(points, benchmarkValues);
        BigDecimal beta = beta(points, benchmarkValues);
        BigDecimal downsideDeviation = downsideDeviation(points);
        BigDecimal sortinoRatio = sortinoRatio(points);
        BigDecimal sharpeRatio = sharpeRatio(points, annualRiskFreeRate);
        BigDecimal alpha = alpha(points, benchmarkValues, annualRiskFreeRate);

        return List.of(
                indicator(
                        "VOLATILITY",
                        "Volatilite (Yıllık)",
                        volatility,
                        UNIT_PERCENT,
                        TONE_NEUTRAL,
                        "Son 252 işlem günündeki fon getirilerinin yıllıklandırılmış dalgalanmasını gösterir."
                ),
                indicator(
                        "MAX_DRAWDOWN",
                        "Maksimum Düşüş (Yıllık)",
                        maximumDrawdown,
                        UNIT_PERCENT,
                        maximumDrawdown == null ? TONE_NEUTRAL : "negative",
                        "Son 252 işlem gününde zirveden dip seviyeye yaşanan en büyük kaybı gösterir."
                ),
                indicator(
                        "TRACKING_ERROR",
                        "Tracking Error (Yıllık)",
                        trackingError,
                        UNIT_PERCENT,
                        TONE_NEUTRAL,
                        "Fonun bileşik karşılaştırma ölçütünden sapmasının yıllıklandırılmış standart sapmasıdır."
                ),
                indicator(
                        "CALMAR",
                        "Calmar Oranı (Yıllık)",
                        calmarRatio,
                        UNIT_RATIO,
                        metricTone(calmarRatio),
                        "Son bir yıllık getirinin mutlak maksimum düşüşe oranını gösterir."
                ),
                indicator(
                        "INFORMATION_RATIO",
                        "Information Ratio (Yıllık)",
                        informationRatio,
                        UNIT_RATIO,
                        metricTone(informationRatio),
                        "Bileşik ölçütün üzerindeki getirinin aktif riske göre verimliliğini gösterir."
                ),
                indicator(
                        "LIQUIDITY_RATIO",
                        "Likidite Oranı",
                        liquidityRatio,
                        UNIT_PERCENT,
                        liquidityRatio.signum() > 0 ? "positive" : TONE_NEUTRAL,
                        "Güncel portföy değerinin likit varlıklarda tutulan bölümünü gösterir."
                ),
                indicator(
                        "BETA",
                        "Beta (Yıllık)",
                        beta,
                        UNIT_RATIO,
                        TONE_NEUTRAL,
                        "Fonun bileşik karşılaştırma ölçütündeki hareketlere duyarlılığını gösterir."
                ),
                indicator(
                        "DOWNSIDE_DEVIATION",
                        "Downside Deviation (Yıllık)",
                        downsideDeviation,
                        UNIT_PERCENT,
                        TONE_NEUTRAL,
                        "MAR yüzde 0 altında kalan getirilerden hesaplanan yıllıklandırılmış aşağı yönlü risktir."
                ),
                indicator(
                        "SORTINO",
                        "Sortino Oranı (Yıllık)",
                        sortinoRatio,
                        UNIT_RATIO,
                        metricTone(sortinoRatio),
                        "MAR yüzde 0 üzerindeki getirinin aşağı yönlü riske oranını gösterir."
                ),
                indicator(
                        "SHARPE",
                        "Sharpe Oranı (Yıllık)",
                        sharpeRatio,
                        UNIT_RATIO,
                        metricTone(sharpeRatio),
                        "TCMB politika faizi üzerindeki getirinin toplam riske oranını gösterir."
                ),
                indicator(
                        "ALPHA",
                        "Alpha (Yıllık)",
                        alpha,
                        UNIT_PERCENT,
                        metricTone(alpha),
                        "Beta ve TCMB politika faizi dikkate alındıktan sonra üretilen yıllık ek getiriyi gösterir."
                )
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
        List<Double> returns = annualFundReturns(points);
        if (returns.isEmpty()) {
            return null;
        }

        return percentageMetric(
                sampleStandardDeviation(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR)
        );
    }

    public BigDecimal maximumDrawdown(List<FundValuationPoint> points) {
        List<FundValuationPoint> annualPoints = annualPoints(points);
        if (annualPoints.isEmpty()) {
            return null;
        }

        double peak = annualPoints.getFirst().sharePrice().doubleValue();
        double worstDrawdown = 0;

        for (FundValuationPoint point : annualPoints) {
            double value = point.sharePrice().doubleValue();
            peak = Math.max(peak, value);
            worstDrawdown = Math.min(worstDrawdown, value / peak - 1);
        }

        return percentageMetric(worstDrawdown);
    }

    public BigDecimal trackingError(
            List<FundValuationPoint> points,
            NavigableMap<LocalDate, BigDecimal> benchmarkValues
    ) {
        AlignedReturns aligned = alignedAnnualReturns(points, benchmarkValues);
        if (aligned.isEmpty()) {
            return null;
        }

        return percentageMetric(
                sampleStandardDeviation(aligned.activeReturns())
                        * Math.sqrt(TRADING_DAYS_PER_YEAR)
        );
    }

    public BigDecimal informationRatio(
            List<FundValuationPoint> points,
            NavigableMap<LocalDate, BigDecimal> benchmarkValues
    ) {
        AlignedReturns aligned = alignedAnnualReturns(points, benchmarkValues);
        if (aligned.isEmpty()) {
            return null;
        }

        List<Double> activeReturns = aligned.activeReturns();
        double activeRisk = sampleStandardDeviation(activeReturns);
        if (activeRisk < ZERO_TOLERANCE) {
            return null;
        }

        return metric(
                mean(activeReturns) / activeRisk * Math.sqrt(TRADING_DAYS_PER_YEAR)
        );
    }

    public BigDecimal calmarRatio(List<FundValuationPoint> points) {
        List<FundValuationPoint> annualPoints = annualPoints(points);
        BigDecimal drawdown = maximumDrawdown(points);
        if (annualPoints.isEmpty()
                || drawdown == null
                || drawdown.abs().doubleValue() < ZERO_TOLERANCE) {
            return null;
        }

        BigDecimal annualReturn = percentageChange(
                annualPoints.getFirst().sharePrice(),
                annualPoints.getLast().sharePrice()
        );
        return annualReturn == null
                ? null
                : annualReturn.divide(drawdown.abs(), METRIC_SCALE, RoundingMode.HALF_UP);
    }

    public BigDecimal beta(
            List<FundValuationPoint> points,
            NavigableMap<LocalDate, BigDecimal> benchmarkValues
    ) {
        AlignedReturns aligned = alignedAnnualReturns(points, benchmarkValues);
        if (aligned.isEmpty()) {
            return null;
        }

        return beta(aligned);
    }

    public BigDecimal downsideDeviation(List<FundValuationPoint> points) {
        List<Double> returns = annualFundReturns(points);
        if (returns.isEmpty()) {
            return null;
        }

        double downsideVariance = returns.stream()
                .mapToDouble(value -> Math.pow(Math.min(0, value), 2))
                .sum() / returns.size();
        return percentageMetric(
                Math.sqrt(downsideVariance) * Math.sqrt(TRADING_DAYS_PER_YEAR)
        );
    }

    public BigDecimal sortinoRatio(List<FundValuationPoint> points) {
        List<Double> returns = annualFundReturns(points);
        if (returns.isEmpty()) {
            return null;
        }

        double downsideVariance = returns.stream()
                .mapToDouble(value -> Math.pow(Math.min(0, value), 2))
                .sum() / returns.size();
        double annualizedDownside = Math.sqrt(downsideVariance)
                * Math.sqrt(TRADING_DAYS_PER_YEAR);
        if (annualizedDownside < ZERO_TOLERANCE) {
            return null;
        }

        return metric(mean(returns) * TRADING_DAYS_PER_YEAR / annualizedDownside);
    }

    public BigDecimal sharpeRatio(
            List<FundValuationPoint> points,
            BigDecimal annualRiskFreeRate
    ) {
        List<Double> returns = annualFundReturns(points);
        if (returns.isEmpty() || annualRiskFreeRate == null) {
            return null;
        }

        double dailyStandardDeviation = sampleStandardDeviation(returns);
        if (dailyStandardDeviation < ZERO_TOLERANCE) {
            return null;
        }

        double annualizedExcessReturn = mean(returns) * TRADING_DAYS_PER_YEAR
                - annualRiskFreeRate.doubleValue() / 100;
        double annualizedStandardDeviation = dailyStandardDeviation
                * Math.sqrt(TRADING_DAYS_PER_YEAR);
        return metric(annualizedExcessReturn / annualizedStandardDeviation);
    }

    public BigDecimal alpha(
            List<FundValuationPoint> points,
            NavigableMap<LocalDate, BigDecimal> benchmarkValues,
            BigDecimal annualRiskFreeRate
    ) {
        AlignedReturns aligned = alignedAnnualReturns(points, benchmarkValues);
        BigDecimal beta = beta(aligned);
        if (aligned.isEmpty() || beta == null || annualRiskFreeRate == null) {
            return null;
        }

        double annualFundReturn = mean(aligned.fundReturns()) * TRADING_DAYS_PER_YEAR;
        double annualBenchmarkReturn = mean(aligned.benchmarkReturns())
                * TRADING_DAYS_PER_YEAR;
        double annualRiskFree = annualRiskFreeRate.doubleValue() / 100;
        double alpha = annualFundReturn - (
                annualRiskFree
                        + beta.doubleValue() * (annualBenchmarkReturn - annualRiskFree)
        );
        return percentageMetric(alpha);
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

    private List<FundValuationPoint> annualPoints(List<FundValuationPoint> points) {
        if (points.size() < 30) {
            return List.of();
        }
        if (points.size() < ANNUAL_PRICE_OBSERVATIONS) {
            return points;
        }
        return points.subList(points.size() - ANNUAL_PRICE_OBSERVATIONS, points.size());
    }

    private List<Double> annualFundReturns(List<FundValuationPoint> points) {
        List<FundValuationPoint> annualPoints = annualPoints(points);
        return annualPoints.isEmpty() ? List.of() : dailyReturns(annualPoints);
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

    private AlignedReturns alignedAnnualReturns(
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

        if (alignedFundReturns.size() < 30) {
            return AlignedReturns.empty();
        }

        if (alignedFundReturns.size() < ANNUAL_RETURN_OBSERVATIONS) {
            return new AlignedReturns(List.copyOf(alignedFundReturns), List.copyOf(alignedBenchmarkReturns));
        }

        int from = alignedFundReturns.size() - ANNUAL_RETURN_OBSERVATIONS;
        return new AlignedReturns(
                List.copyOf(alignedFundReturns.subList(from, alignedFundReturns.size())),
                List.copyOf(alignedBenchmarkReturns.subList(from, alignedBenchmarkReturns.size()))
        );
    }

    private BigDecimal beta(AlignedReturns aligned) {
        if (aligned.isEmpty()) {
            return null;
        }

        double fundMean = mean(aligned.fundReturns());
        double benchmarkMean = mean(aligned.benchmarkReturns());
        double covariance = 0;
        double benchmarkVariance = 0;

        for (int index = 0; index < aligned.fundReturns().size(); index++) {
            double fundDeviation = aligned.fundReturns().get(index) - fundMean;
            double benchmarkDeviation = aligned.benchmarkReturns().get(index)
                    - benchmarkMean;
            covariance += fundDeviation * benchmarkDeviation;
            benchmarkVariance += benchmarkDeviation * benchmarkDeviation;
        }

        if (benchmarkVariance < ZERO_TOLERANCE) {
            return null;
        }
        return metric(covariance / benchmarkVariance);
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
            String tone,
            String description
    ) {
        return new TechnicalIndicatorResponse(
                code,
                label,
                value,
                unit,
                tone,
                description
        );
    }

    private BigDecimal percentageMetric(double decimalValue) {
        return metric(decimalValue * 100);
    }

    private BigDecimal metric(double value) {
        return BigDecimal.valueOf(value).setScale(METRIC_SCALE, RoundingMode.HALF_UP);
    }

    private record AlignedReturns(
            List<Double> fundReturns,
            List<Double> benchmarkReturns
    ) {
        private static AlignedReturns empty() {
            return new AlignedReturns(List.of(), List.of());
        }

        private boolean isEmpty() {
            return fundReturns.isEmpty();
        }

        private List<Double> activeReturns() {
            List<Double> active = new ArrayList<>(fundReturns.size());
            for (int index = 0; index < fundReturns.size(); index++) {
                active.add(fundReturns.get(index) - benchmarkReturns.get(index));
            }
            return active;
        }
    }
}
