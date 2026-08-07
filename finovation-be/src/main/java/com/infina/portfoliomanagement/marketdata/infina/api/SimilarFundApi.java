package com.infina.portfoliomanagement.marketdata.infina.api;

import com.infina.portfoliomanagement.marketdata.infina.client.InfinaClient;
import com.infina.portfoliomanagement.marketdata.infina.client.InfinaEndpoint;
import com.infina.portfoliomanagement.marketdata.infina.dto.FundProfileRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class SimilarFundApi {

    private static final String COMPARISON_PERIODS =
            "P1W,P1M,P3M,P6M,XYTD,P1Y,P3Y,P5Y";

    private final InfinaClient infinaClient;

    public Optional<FundProfileRecord> fetchComparisons(
            List<String> fundCodes,
            LocalDate asOfDate
    ) {
        if (fundCodes.isEmpty()) {
            return Optional.empty();
        }

        MultiValueMap<String, String> parameters = new LinkedMultiValueMap<>();
        parameters.add("fund_code", fundCodes.getFirst());
        parameters.add("date", asOfDate.toString());
        parameters.add("periods", COMPARISON_PERIODS);
        parameters.add("indices", "");
        parameters.add("currencies", "");
        parameters.add("funds", String.join(",", fundCodes));
        parameters.add("extract", "FundBenchmark");

        return infinaClient.getObject(
                InfinaEndpoint.FUND_PROFILE_V2,
                parameters,
                FundProfileRecord.class
        );
    }
}
