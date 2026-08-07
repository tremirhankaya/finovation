package com.infina.portfoliomanagement.marketdata.infina.api;

import com.infina.portfoliomanagement.marketdata.infina.client.InfinaClient;
import com.infina.portfoliomanagement.marketdata.infina.client.InfinaEndpoint;
import com.infina.portfoliomanagement.marketdata.infina.dto.EconomicPriceRecord;
import com.infina.portfoliomanagement.marketdata.infina.dto.IndexPriceRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.Month;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class BenchmarkPriceApiTest {

    private static final LocalDate FROM_DATE = LocalDate.of(
            2021,
            Month.JUNE,
            21
    );
    private static final LocalDate TO_DATE = LocalDate.of(
            2026,
            Month.AUGUST,
            5
    );

    @Mock
    private InfinaClient infinaClient;

    private BenchmarkPriceApi api;

    @BeforeEach
    void setUp() {
        api = new BenchmarkPriceApi(infinaClient);
    }

    @Test
    void fetchIndexRange_usesIndexEndpointAndRangeParameters() {
        api.fetchIndexRange("XU100", FROM_DATE, TO_DATE);

        verify(infinaClient).get(
                eq(InfinaEndpoint.INDEX_PRICE),
                argThat(parameters -> "XU100".equals(
                                parameters.getFirst("asset_code")
                        ) && "[2021-06-21,2026-08-05]".equals(
                                parameters.getFirst("data_date")
                        )),
                eq(IndexPriceRecord.class)
        );
    }

    @Test
    void fetchEconomicRange_usesEconomicEndpointAndRangeParameters() {
        api.fetchEconomicRange("TUCPIM", FROM_DATE, TO_DATE);

        verify(infinaClient).get(
                eq(InfinaEndpoint.ECONOMIC_PRICE),
                argThat(parameters -> "TUCPIM".equals(
                                parameters.getFirst("asset_code")
                        ) && "[2021-06-21,2026-08-05]".equals(
                                parameters.getFirst("data_date")
                        )),
                eq(EconomicPriceRecord.class)
        );
    }
}
