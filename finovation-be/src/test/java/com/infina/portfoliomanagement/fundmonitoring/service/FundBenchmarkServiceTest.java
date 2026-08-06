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
import java.time.LocalDate;
import java.time.Month;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
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

    private FundBenchmarkService service;

    @BeforeEach
    void setUp() {
        service = new FundBenchmarkService(
                benchmarkPriceApi,
                new FundMetricCalculator()
        );
    }

    @Test
    void comparisonAssets_calculatesBistAndInflationReturns() {
        when(benchmarkPriceApi.fetchIndexRange(
                "XU030",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                indexPrice("XU030", AS_OF_DATE.minusMonths(1), "100"),
                indexPrice("XU030", AS_OF_DATE, "110")
        ));
        when(benchmarkPriceApi.fetchIndexRange(
                "XU100",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                indexPrice("XU100", AS_OF_DATE.minusMonths(1), "200"),
                indexPrice("XU100", AS_OF_DATE, "240")
        ));
        when(benchmarkPriceApi.fetchEconomicRange(
                "TUCPIM",
                FROM_DATE,
                AS_OF_DATE
        )).thenReturn(List.of(
                economicPrice(AS_OF_DATE.minusMonths(1), "400"),
                economicPrice(AS_OF_DATE, "420")
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
                        tuple("BIST30", "BIST 30", false, new BigDecimal("10.0000")),
                        tuple("BIST100", "BIST 100", false, new BigDecimal("20.0000")),
                        tuple("TUFE", "TÜFE", false, new BigDecimal("5.0000"))
                );
        assertThat(snapshot.bist100Values())
                .containsEntry(AS_OF_DATE, new BigDecimal("240"));
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
