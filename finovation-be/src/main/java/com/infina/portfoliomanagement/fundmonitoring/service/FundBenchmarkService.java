package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundComparisonAssetResponse;
import com.infina.portfoliomanagement.fundmonitoring.model.ComparisonPeriod;
import com.infina.portfoliomanagement.marketdata.infina.api.BenchmarkPriceApi;
import com.infina.portfoliomanagement.marketdata.infina.dto.EconomicPriceRecord;
import com.infina.portfoliomanagement.marketdata.infina.dto.IndexPriceRecord;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
@Slf4j
public class FundBenchmarkService {

    private static final int HISTORY_LOOKBACK_BUFFER_DAYS = 45;
    private static final String BIST_30_SOURCE_CODE = "XU030";
    private static final String BIST_100_SOURCE_CODE = "XU100";
    private static final String INFLATION_SOURCE_CODE = "TUCPIM";

    private final BenchmarkPriceApi benchmarkPriceApi;
    private final FundMetricCalculator metricCalculator;

    public BenchmarkSnapshot load(LocalDate asOfDate) {
        LocalDate from = ComparisonPeriod.FIVE_YEARS.startDate(asOfDate)
                .minusDays(HISTORY_LOOKBACK_BUFFER_DAYS);
        NavigableMap<LocalDate, BigDecimal> bist30Values = safelyLoad(
                BIST_30_SOURCE_CODE,
                () -> indexValues(BIST_30_SOURCE_CODE, from, asOfDate)
        );
        NavigableMap<LocalDate, BigDecimal> bist100Values = safelyLoad(
                BIST_100_SOURCE_CODE,
                () -> indexValues(BIST_100_SOURCE_CODE, from, asOfDate)
        );
        NavigableMap<LocalDate, BigDecimal> inflationValues = safelyLoad(
                INFLATION_SOURCE_CODE,
                () -> economicValues(INFLATION_SOURCE_CODE, from, asOfDate)
        );

        List<FundComparisonAssetResponse> assets = List.of(
                comparisonAsset(
                        "bist-30",
                        "BIST30",
                        "BIST 30",
                        "#2563eb",
                        bist30Values,
                        asOfDate
                ),
                comparisonAsset(
                        "bist-100",
                        "BIST100",
                        "BIST 100",
                        "#7c3aed",
                        bist100Values,
                        asOfDate
                ),
                comparisonAsset(
                        "inflation",
                        "TUFE",
                        "TÜFE",
                        "#ea580c",
                        inflationValues,
                        asOfDate
                )
        );
        return new BenchmarkSnapshot(assets, bist100Values);
    }

    private NavigableMap<LocalDate, BigDecimal> indexValues(
            String sourceCode,
            LocalDate from,
            LocalDate to
    ) {
        NavigableMap<LocalDate, BigDecimal> values = new TreeMap<>();
        for (IndexPriceRecord indexPrice : benchmarkPriceApi.fetchIndexRange(
                sourceCode,
                from,
                to
        )) {
            if (indexPrice.dataDate() != null && indexPrice.closePrice() != null) {
                values.put(indexPrice.dataDate(), indexPrice.closePrice());
            }
        }
        return values;
    }

    private NavigableMap<LocalDate, BigDecimal> economicValues(
            String sourceCode,
            LocalDate from,
            LocalDate to
    ) {
        NavigableMap<LocalDate, BigDecimal> values = new TreeMap<>();
        for (EconomicPriceRecord economicPrice : benchmarkPriceApi.fetchEconomicRange(
                sourceCode,
                from,
                to
        )) {
            if (economicPrice.dataDate() != null && economicPrice.price() != null) {
                values.put(economicPrice.dataDate(), economicPrice.price());
            }
        }
        return values;
    }

    private NavigableMap<LocalDate, BigDecimal> safelyLoad(
            String sourceCode,
            Supplier<NavigableMap<LocalDate, BigDecimal>> loader
    ) {
        try {
            return loader.get();
        } catch (BaseException | RestClientException
                 | CallNotPermittedException | RequestNotPermitted exception) {
            log.warn(
                    "Comparison data is unavailable for benchmark {}: {}",
                    sourceCode,
                    exception.getClass().getSimpleName()
            );
            return new TreeMap<>();
        }
    }

    private FundComparisonAssetResponse comparisonAsset(
            String id,
            String code,
            String name,
            String color,
            NavigableMap<LocalDate, BigDecimal> values,
            LocalDate asOfDate
    ) {
        Map<String, BigDecimal> returns = metricCalculator.comparisonReturns(
                values,
                asOfDate
        );
        return new FundComparisonAssetResponse(
                id,
                code,
                name,
                color,
                false,
                returns
        );
    }

    public record BenchmarkSnapshot(
            List<FundComparisonAssetResponse> comparisonAssets,
            NavigableMap<LocalDate, BigDecimal> bist100Values
    ) {
        public BenchmarkSnapshot {
            comparisonAssets = List.copyOf(comparisonAssets);
            bist100Values = Collections.unmodifiableNavigableMap(
                    new TreeMap<>(bist100Values)
            );
        }
    }
}
