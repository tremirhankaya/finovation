package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundComparisonAssetResponse;
import com.infina.portfoliomanagement.fundmonitoring.service.FundBenchmarkService.BenchmarkSnapshot;
import com.infina.portfoliomanagement.marketdata.infina.api.BenchmarkPriceApi;
import com.infina.portfoliomanagement.marketdata.infina.dto.EconomicPriceRecord;
import com.infina.portfoliomanagement.marketdata.infina.dto.IndexPriceRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Month;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FundBenchmarkServiceTest {

    private static final LocalDate AS_OF_DATE = LocalDate.of(
            2026,
            Month.AUGUST,
            5
    );
    private static final LocalDate FROM_DATE = AS_OF_DATE.minusYears(5)
            .minusDays(45);

    @Mock
    private BenchmarkPriceApi benchmarkPriceApi;
    @Mock
    private Clock clock;

    private FundBenchmarkService service;
    private AtomicReference<Instant> currentTime;

    @BeforeEach
    void setUp() {
        currentTime = new AtomicReference<>(
                Instant.parse("2026-08-11T08:00:00Z")
        );
        when(clock.instant()).thenAnswer(invocation -> currentTime.get());
        service = new FundBenchmarkService(
                benchmarkPriceApi,
                new FundMetricCalculator(),
                clock
        );
    }

    @Test
    void load_buildsCompositeBenchmarkAndRefreshesCacheAfterThirtyMinutes() {
        when(benchmarkPriceApi.fetchIndexRange(
                "XU030",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                indexPrice("XU030", AS_OF_DATE.minusMonths(1), "100"),
                indexPrice("XU030", AS_OF_DATE, "110")
        ));
        when(benchmarkPriceApi.fetchIndexRange(
                "XU100_CFNNTLTL",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                indexPrice("XU100_CFNNTLTL", AS_OF_DATE.minusMonths(1), "200"),
                indexPrice("XU100_CFNNTLTL", AS_OF_DATE, "240")
        ));
        when(benchmarkPriceApi.fetchIndexRange(
                "REPBR",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                indexPrice("REPBR", AS_OF_DATE.minusMonths(1), "1000"),
                indexPrice("REPBR", AS_OF_DATE, "1100")
        ));
        when(benchmarkPriceApi.fetchIndexRange(
                "MEVTL",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                indexPrice("MEVTL", AS_OF_DATE.minusMonths(1), "100"),
                indexPrice("MEVTL", AS_OF_DATE, "104")
        ));
        when(benchmarkPriceApi.fetchEconomicRange(
                "TUCPIM",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                economicPrice(AS_OF_DATE.minusMonths(1), "2"),
                economicPrice(AS_OF_DATE, "3")
        ));
        when(benchmarkPriceApi.fetchIndexRange(
                "XGLD",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                indexPrice("XGLD", AS_OF_DATE.minusMonths(1), "100"),
                indexPrice("XGLD", AS_OF_DATE, "130")
        ));
        when(benchmarkPriceApi.fetchIndexRange(
                "USD/TRY",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                indexPrice("USD/TRY", AS_OF_DATE.minusMonths(1), "40"),
                indexPrice("USD/TRY", AS_OF_DATE, "44")
        ));
        when(benchmarkPriceApi.fetchIndexRange(
                "EUR/TRY",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                indexPrice("EUR/TRY", AS_OF_DATE.minusMonths(1), "50"),
                indexPrice("EUR/TRY", AS_OF_DATE, "55")
        ));

        BenchmarkSnapshot snapshot = service.load(AS_OF_DATE);
        List<FundComparisonAssetResponse> assets = snapshot.comparisonAssets();

        assertThat(assets)
                .extracting(
                        FundComparisonAssetResponse::code,
                        FundComparisonAssetResponse::name,
                        FundComparisonAssetResponse::isFund,
                        item -> item.returns().get("1M")
                )
                .containsExactly(
                        tuple(
                                "BENCHMARK",
                                "BENCHMARK",
                                false,
                                new BigDecimal("19.0000")
                        ),
                        tuple(
                                "BIST100G",
                                "BIST 100 Getiri Endeksi",
                                false,
                                new BigDecimal("20.0000")
                        ),
                        tuple("BIST30", "BIST 30", false, new BigDecimal("10.0000")),
                        tuple(
                                "MEVDUAT",
                                "Mevduat Getirisi",
                                false,
                                new BigDecimal("4.0000")
                        ),
                        tuple("TUFE", "TÜFE", false, new BigDecimal("3.0000")),
                        tuple(
                                "ALTIN",
                                "Gram Altın",
                                false,
                                new BigDecimal("30.0000")
                        ),
                        tuple(
                                "USD/TRY",
                                "USD",
                                false,
                                new BigDecimal("10.0000")
                        ),
                        tuple(
                                "EUR/TRY",
                                "Euro",
                                false,
                                new BigDecimal("10.0000")
                        ),
                        tuple(
                                "REPBR",
                                "BIST-KYD Repo (Brüt) Endeksi",
                                false,
                                new BigDecimal("10.0000")
                        )
                );
        assertThat(snapshot.benchmarkValues())
                .containsEntry(AS_OF_DATE, new BigDecimal("119.000000000000"));
        assertThat(snapshot.benchmarkDefinition().components())
                .extracting(
                        component -> component.code(),
                        component -> component.weightPercentage()
                )
                .containsExactly(
                        tuple("XU100_CFNNTLTL", new BigDecimal("90")),
                        tuple("REPBR", new BigDecimal("10"))
                );

        assertThat(service.load(AS_OF_DATE)).isSameAs(snapshot);
        verify(benchmarkPriceApi).fetchIndexRange(
                "XU030",
                FROM_DATE,
                AS_OF_DATE
        );

        currentTime.updateAndGet(time -> time.plus(Duration.ofMinutes(31)));
        assertThat(service.load(AS_OF_DATE)).isNotSameAs(snapshot);
        verify(benchmarkPriceApi, times(2)).fetchIndexRange(
                "XU030",
                FROM_DATE,
                AS_OF_DATE
        );
    }

    @Test
    void load_fetchesIndependentBenchmarksConcurrently() throws Exception {
        CountDownLatch requestsStarted = new CountDownLatch(8);
        CountDownLatch releaseResponses = new CountDownLatch(1);

        when(benchmarkPriceApi.fetchIndexRange(
                anyString(),
                eq(FROM_DATE),
                eq(AS_OF_DATE)
        )).thenAnswer(invocation -> {
            requestsStarted.countDown();
            releaseResponses.await(5, TimeUnit.SECONDS);
            return List.of();
        });
        when(benchmarkPriceApi.fetchEconomicRange(
                anyString(),
                eq(FROM_DATE),
                eq(AS_OF_DATE)
        )).thenAnswer(invocation -> {
            requestsStarted.countDown();
            releaseResponses.await(5, TimeUnit.SECONDS);
            return List.of();
        });

        try (var caller = Executors.newSingleThreadExecutor()) {
            var result = caller.submit(() -> service.load(AS_OF_DATE));
            try {
                assertThat(requestsStarted.await(2, TimeUnit.SECONDS)).isTrue();
            } finally {
                releaseResponses.countDown();
            }
            assertThat(result.get(5, TimeUnit.SECONDS)).isNotNull();
        }
    }

    private IndexPriceRecord indexPrice(
            String assetCode,
            LocalDate date,
            String value
    ) {
        return new IndexPriceRecord(
                assetCode,
                assetCode,
                date,
                new BigDecimal(value)
        );
    }

    private EconomicPriceRecord economicPrice(LocalDate date, String value) {
        return new EconomicPriceRecord(
                "TUCPIM",
                "TÜFE",
                date.toString(),
                date,
                new BigDecimal(value)
        );
    }
}
