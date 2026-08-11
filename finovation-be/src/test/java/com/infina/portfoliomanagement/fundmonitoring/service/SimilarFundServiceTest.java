package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundComparisonAssetResponse;
import com.infina.portfoliomanagement.marketdata.infina.api.SimilarFundApi;
import com.infina.portfoliomanagement.marketdata.infina.dto.FundProfileRecord;
import com.infina.portfoliomanagement.marketdata.infina.dto.FundProfileRecord.FundBenchmarkRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Month;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SimilarFundServiceTest {

    private static final LocalDate AS_OF_DATE = LocalDate.of(
            2026,
            Month.AUGUST,
            5
    );
    private static final List<String> PEER_CODES = List.of(
            "MAC",
            "IIH",
            "TI2",
            "YAS",
            "AK3",
            "GHS",
            "GMR",
            "HVS",
            "TKF",
            "TZD"
    );

    @Mock
    private SimilarFundApi similarFundApi;

    private SimilarFundService service;

    @BeforeEach
    void setUp() {
        service = new SimilarFundService(similarFundApi);
    }

    @Test
    void comparisonAssets_mapsInfinaFundPeriodsToFrontendPeriods() {
        FundProfileRecord profile = new FundProfileRecord(
                List.of(
                        "P1W",
                        "P1M",
                        "P3M",
                        "P6M",
                        "XYTD",
                        "P1Y",
                        "P3Y",
                        "P5Y"
                ),
                List.of(
                        benchmark("MAC", "Marmara Hisse Fonu", "1"),
                        benchmark("IIH", "İstanbul Hisse Fonu", "2"),
                        benchmark("XU100", "BIST 100", "3")
                )
        );
        when(similarFundApi.fetchComparisons(PEER_CODES, AS_OF_DATE))
                .thenReturn(Optional.of(profile));

        List<FundComparisonAssetResponse> assets = service.comparisonAssets(
                FundType.EQUITY_INTENSIVE,
                AS_OF_DATE
        );

        assertThat(assets)
                .extracting(
                        FundComparisonAssetResponse::code,
                        FundComparisonAssetResponse::name,
                        FundComparisonAssetResponse::isFund,
                        item -> item.returns().get("YTD"),
                        item -> item.returns().size()
                )
                .containsExactly(
                        tuple(
                                "MAC",
                                "Marmara Hisse Fonu",
                                true,
                                new BigDecimal("1"),
                                8
                        ),
                        tuple(
                                "IIH",
                                "İstanbul Hisse Fonu",
                                true,
                                new BigDecimal("2"),
                                8
                        )
                );

        assertThat(service.comparisonAssets(
                FundType.EQUITY_INTENSIVE,
                AS_OF_DATE
        )).isSameAs(assets);
        verify(similarFundApi).fetchComparisons(PEER_CODES, AS_OF_DATE);
    }

    @Test
    void comparisonAssets_returnsTenConfiguredFundsWithDistinctColors() {
        FundProfileRecord profile = new FundProfileRecord(
                List.of("P1Y"),
                PEER_CODES.stream()
                        .map(code -> benchmark(code, code + " Fund", "1"))
                        .toList()
        );
        when(similarFundApi.fetchComparisons(PEER_CODES, AS_OF_DATE))
                .thenReturn(Optional.of(profile));

        List<FundComparisonAssetResponse> assets = service.comparisonAssets(
                FundType.EQUITY_INTENSIVE,
                AS_OF_DATE
        );

        assertThat(assets)
                .extracting(FundComparisonAssetResponse::code)
                .containsExactlyElementsOf(PEER_CODES);
        assertThat(assets)
                .extracting(FundComparisonAssetResponse::color)
                .doesNotHaveDuplicates();
    }

    private FundBenchmarkRecord benchmark(
            String code,
            String name,
            String returnValue
    ) {
        return new FundBenchmarkRecord(
                code,
                name,
                code.startsWith("XU") ? "Index" : "Fund",
                Collections.nCopies(8, new BigDecimal(returnValue))
        );
    }
}
