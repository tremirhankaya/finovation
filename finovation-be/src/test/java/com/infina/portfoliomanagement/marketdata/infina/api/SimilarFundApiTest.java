package com.infina.portfoliomanagement.marketdata.infina.api;

import com.infina.portfoliomanagement.marketdata.infina.client.InfinaClient;
import com.infina.portfoliomanagement.marketdata.infina.client.InfinaEndpoint;
import com.infina.portfoliomanagement.marketdata.infina.dto.FundProfileRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.Month;
import java.util.List;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SimilarFundApiTest {

    private static final LocalDate AS_OF_DATE = LocalDate.of(
            2026,
            Month.AUGUST,
            5
    );

    @Mock
    private InfinaClient infinaClient;

    private SimilarFundApi api;

    @BeforeEach
    void setUp() {
        api = new SimilarFundApi(infinaClient);
    }

    @Test
    void fetchComparisons_usesFundProfileEndpointAndComparisonParameters() {
        api.fetchComparisons(List.of("MAC", "IIH"), AS_OF_DATE);

        verify(infinaClient).getObject(
                eq(InfinaEndpoint.FUND_PROFILE_V2),
                argThat(parameters -> "MAC".equals(
                                parameters.getFirst("fund_code")
                        ) && "MAC,IIH".equals(parameters.getFirst("funds"))
                                && "P1W,P1M,P3M,P6M,XYTD,P1Y,P3Y,P5Y".equals(
                                parameters.getFirst("periods")
                        )),
                eq(FundProfileRecord.class)
        );
    }
}
