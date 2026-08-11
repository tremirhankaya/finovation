package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.BenchmarkComponentResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.BenchmarkDefinitionResponse;
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
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.NavigableSet;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
@Slf4j
public class FundBenchmarkService {

    private static final int HISTORY_LOOKBACK_BUFFER_DAYS = 45;
    private static final String BIST_30_SOURCE_CODE = "XU030";
    private static final String BIST_100_RETURN_SOURCE_CODE = "XU100_CFNNTLTL";
    private static final String REPO_GROSS_SOURCE_CODE = "REPBR";
    private static final String DEPOSIT_TRY_SOURCE_CODE = "MEVTL";
    private static final String INFLATION_SOURCE_CODE = "TUCPIM";
    private static final String GOLD_TRY_SOURCE_CODE = "XGLD";
    private static final String USD_TRY_SOURCE_CODE = "USD/TRY";
    private static final String EUR_TRY_SOURCE_CODE = "EUR/TRY";
    private static final BigDecimal BIST_100_WEIGHT = new BigDecimal("0.90");
    private static final BigDecimal REPO_GROSS_WEIGHT = new BigDecimal("0.10");
    private static final BigDecimal COMPOSITE_BASE_VALUE = new BigDecimal("100");
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);

    private final BenchmarkPriceApi benchmarkPriceApi;
    private final FundMetricCalculator metricCalculator;
    private final Clock clock;
    private final Object cacheMonitor = new Object();
    private volatile CachedBenchmark cachedBenchmark;

    public BenchmarkSnapshot load(LocalDate asOfDate) {
        Instant now = clock.instant();
        CachedBenchmark cached = cachedBenchmark;
        if (isCacheValid(cached, asOfDate, now)) {
            return cached.snapshot();
        }

        synchronized (cacheMonitor) {
            now = clock.instant();
            cached = cachedBenchmark;
            if (isCacheValid(cached, asOfDate, now)) {
                return cached.snapshot();
            }

            BenchmarkSnapshot snapshot = loadFresh(asOfDate);
            if (!snapshot.benchmarkValues().isEmpty()) {
                cachedBenchmark = new CachedBenchmark(
                        asOfDate,
                        snapshot,
                        clock.instant().plus(CACHE_TTL)
                );
            }
            return snapshot;
        }
    }

    private boolean isCacheValid(
            CachedBenchmark cached,
            LocalDate asOfDate,
            Instant now
    ) {
        return cached != null
                && cached.asOfDate().equals(asOfDate)
                && now.isBefore(cached.expiresAt());
    }

    private BenchmarkSnapshot loadFresh(LocalDate asOfDate) {
        LocalDate from = ComparisonPeriod.FIVE_YEARS.startDate(asOfDate)
                .minusDays(HISTORY_LOOKBACK_BUFFER_DAYS);
        NavigableMap<LocalDate, BigDecimal> bist30Values;
        NavigableMap<LocalDate, BigDecimal> bist100ReturnValues;
        NavigableMap<LocalDate, BigDecimal> repoGrossValues;
        NavigableMap<LocalDate, BigDecimal> depositTryValues;
        NavigableMap<LocalDate, BigDecimal> inflationValues;
        NavigableMap<LocalDate, BigDecimal> goldTryValues;
        NavigableMap<LocalDate, BigDecimal> usdTryValues;
        NavigableMap<LocalDate, BigDecimal> eurTryValues;

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            CompletableFuture<NavigableMap<LocalDate, BigDecimal>> bist30Future =
                    CompletableFuture.supplyAsync(
                            () -> safelyLoad(
                                    BIST_30_SOURCE_CODE,
                                    () -> indexValues(BIST_30_SOURCE_CODE, from, asOfDate)
                            ),
                            executor
                    );
            CompletableFuture<NavigableMap<LocalDate, BigDecimal>> bist100Future =
                    CompletableFuture.supplyAsync(
                            () -> safelyLoad(
                                    BIST_100_RETURN_SOURCE_CODE,
                                    () -> indexValues(BIST_100_RETURN_SOURCE_CODE, from, asOfDate)
                            ),
                            executor
                    );
            CompletableFuture<NavigableMap<LocalDate, BigDecimal>> repoFuture =
                    CompletableFuture.supplyAsync(
                            () -> safelyLoad(
                                    REPO_GROSS_SOURCE_CODE,
                                    () -> indexValues(REPO_GROSS_SOURCE_CODE, from, asOfDate)
                            ),
                            executor
                    );
            CompletableFuture<NavigableMap<LocalDate, BigDecimal>> depositFuture =
                    CompletableFuture.supplyAsync(
                            () -> safelyLoad(
                                    DEPOSIT_TRY_SOURCE_CODE,
                                    () -> indexValues(DEPOSIT_TRY_SOURCE_CODE, from, asOfDate)
                            ),
                            executor
                    );
            CompletableFuture<NavigableMap<LocalDate, BigDecimal>> inflationFuture =
                    CompletableFuture.supplyAsync(
                            () -> safelyLoad(
                                    INFLATION_SOURCE_CODE,
                                    () -> inflationIndexValues(INFLATION_SOURCE_CODE, from, asOfDate)
                            ),
                            executor
                    );
            CompletableFuture<NavigableMap<LocalDate, BigDecimal>> goldFuture =
                    CompletableFuture.supplyAsync(
                            () -> safelyLoad(
                                    GOLD_TRY_SOURCE_CODE,
                                    () -> indexValues(GOLD_TRY_SOURCE_CODE, from, asOfDate)
                            ),
                            executor
                    );
            CompletableFuture<NavigableMap<LocalDate, BigDecimal>> usdFuture =
                    CompletableFuture.supplyAsync(
                            () -> safelyLoad(
                                    USD_TRY_SOURCE_CODE,
                                    () -> indexValues(USD_TRY_SOURCE_CODE, from, asOfDate)
                            ),
                            executor
                    );
            CompletableFuture<NavigableMap<LocalDate, BigDecimal>> eurFuture =
                    CompletableFuture.supplyAsync(
                            () -> safelyLoad(
                                    EUR_TRY_SOURCE_CODE,
                                    () -> indexValues(EUR_TRY_SOURCE_CODE, from, asOfDate)
                            ),
                            executor
                    );

            bist30Values = bist30Future.join();
            bist100ReturnValues = bist100Future.join();
            repoGrossValues = repoFuture.join();
            depositTryValues = depositFuture.join();
            inflationValues = inflationFuture.join();
            goldTryValues = goldFuture.join();
            usdTryValues = usdFuture.join();
            eurTryValues = eurFuture.join();
        }

        NavigableMap<LocalDate, BigDecimal> compositeBenchmarkValues =
                compositeValues(bist100ReturnValues, repoGrossValues);
        BenchmarkDefinitionResponse benchmarkDefinition = new BenchmarkDefinitionResponse(
                "Fon Karşılaştırma Ölçütü",
                List.of(
                        new BenchmarkComponentResponse(
                                BIST_100_RETURN_SOURCE_CODE,
                                "BIST 100 Getiri Endeksi",
                                new BigDecimal("90")
                        ),
                        new BenchmarkComponentResponse(
                                REPO_GROSS_SOURCE_CODE,
                                "BIST-KYD Repo (Brüt) Endeksi",
                                new BigDecimal("10")
                        )
                )
        );

        List<FundComparisonAssetResponse> assets = List.of(
                comparisonAsset(
                        "official-equity-benchmark",
                        "BENCHMARK",
                        "BENCHMARK",
                        "#dc2626",
                        compositeBenchmarkValues,
                        asOfDate
                ),
                comparisonAsset(
                        "bist-100-return",
                        "BIST100G",
                        "BIST 100 Getiri Endeksi",
                        "#7c3aed",
                        bist100ReturnValues,
                        asOfDate
                ),
                comparisonAsset(
                        "bist-30",
                        "BIST30",
                        "BIST 30",
                        "#2563eb",
                        bist30Values,
                        asOfDate
                ),
                comparisonAsset(
                        "deposit-try",
                        "MEVDUAT",
                        "Mevduat Getirisi",
                        "#0f766e",
                        depositTryValues,
                        asOfDate
                ),
                comparisonAsset(
                        "inflation",
                        "TUFE",
                        "TÜFE",
                        "#ea580c",
                        inflationValues,
                        asOfDate
                ),
                comparisonAsset(
                        "gold-try",
                        "ALTIN",
                        "Gram Altın",
                        "#ca8a04",
                        goldTryValues,
                        asOfDate
                ),
                comparisonAsset(
                        "usd-try",
                        "USD/TRY",
                        "USD",
                        "#16a34a",
                        usdTryValues,
                        asOfDate
                ),
                comparisonAsset(
                        "eur-try",
                        "EUR/TRY",
                        "Euro",
                        "#0284c7",
                        eurTryValues,
                        asOfDate
                ),
                comparisonAsset(
                        "repo-gross",
                        "REPBR",
                        "BIST-KYD Repo (Brüt) Endeksi",
                        "#0891b2",
                        repoGrossValues,
                        asOfDate
                )
        );
        return new BenchmarkSnapshot(
                assets,
                compositeBenchmarkValues,
                benchmarkDefinition
        );
    }

    private NavigableMap<LocalDate, BigDecimal> compositeValues(
            NavigableMap<LocalDate, BigDecimal> bist100ReturnValues,
            NavigableMap<LocalDate, BigDecimal> repoGrossValues
    ) {
        NavigableSet<LocalDate> commonDates = new TreeSet<>(
                bist100ReturnValues.navigableKeySet()
        );
        commonDates.retainAll(repoGrossValues.navigableKeySet());

        NavigableMap<LocalDate, BigDecimal> composite = new TreeMap<>();
        if (commonDates.isEmpty()) {
            return composite;
        }

        LocalDate previousDate = commonDates.getFirst();
        BigDecimal compositeValue = COMPOSITE_BASE_VALUE;
        composite.put(previousDate, compositeValue);

        for (LocalDate date : commonDates.tailSet(previousDate, false)) {
            BigDecimal previousBist = bist100ReturnValues.get(previousDate);
            BigDecimal currentBist = bist100ReturnValues.get(date);
            BigDecimal previousRepo = repoGrossValues.get(previousDate);
            BigDecimal currentRepo = repoGrossValues.get(date);
            if (previousBist.signum() <= 0 || previousRepo.signum() <= 0) {
                previousDate = date;
                continue;
            }

            BigDecimal bistReturn = currentBist.divide(
                    previousBist,
                    16,
                    RoundingMode.HALF_UP
            ).subtract(BigDecimal.ONE);
            BigDecimal repoReturn = currentRepo.divide(
                    previousRepo,
                    16,
                    RoundingMode.HALF_UP
            ).subtract(BigDecimal.ONE);
            BigDecimal weightedReturn = bistReturn.multiply(BIST_100_WEIGHT)
                    .add(repoReturn.multiply(REPO_GROSS_WEIGHT));
            compositeValue = compositeValue.multiply(
                    BigDecimal.ONE.add(weightedReturn)
            ).setScale(12, RoundingMode.HALF_UP);
            composite.put(date, compositeValue);
            previousDate = date;
        }
        return composite;
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

    private NavigableMap<LocalDate, BigDecimal> inflationIndexValues(
            String sourceCode,
            LocalDate from,
            LocalDate to
    ) {
        NavigableMap<LocalDate, BigDecimal> monthlyRates = new TreeMap<>();
        for (EconomicPriceRecord economicPrice : benchmarkPriceApi.fetchEconomicRange(
                sourceCode,
                from,
                to
        )) {
            if (economicPrice.dataDate() != null && economicPrice.price() != null) {
                monthlyRates.put(economicPrice.dataDate(), economicPrice.price());
            }
        }

        NavigableMap<LocalDate, BigDecimal> values = new TreeMap<>();
        BigDecimal cumulativeIndex = COMPOSITE_BASE_VALUE;
        for (Map.Entry<LocalDate, BigDecimal> monthlyRate : monthlyRates.entrySet()) {
            BigDecimal growthFactor = BigDecimal.ONE.add(
                    monthlyRate.getValue().movePointLeft(2)
            );
            cumulativeIndex = cumulativeIndex.multiply(growthFactor)
                    .setScale(12, RoundingMode.HALF_UP);
            values.put(monthlyRate.getKey(), cumulativeIndex);
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
            NavigableMap<LocalDate, BigDecimal> benchmarkValues,
            BenchmarkDefinitionResponse benchmarkDefinition
    ) {
        public BenchmarkSnapshot {
            comparisonAssets = List.copyOf(comparisonAssets);
            benchmarkValues = Collections.unmodifiableNavigableMap(
                    new TreeMap<>(benchmarkValues)
            );
        }
    }

    private record CachedBenchmark(
            LocalDate asOfDate,
            BenchmarkSnapshot snapshot,
            Instant expiresAt
    ) {
    }
}
