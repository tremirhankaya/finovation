package com.infina.portfoliomanagement.marketdata.infina.api;

import com.infina.portfoliomanagement.marketdata.infina.client.InfinaClient;
import com.infina.portfoliomanagement.marketdata.infina.client.InfinaEndpoint;
import com.infina.portfoliomanagement.marketdata.infina.dto.EconomicPriceRecord;
import com.infina.portfoliomanagement.marketdata.infina.dto.IndexPriceRecord;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.time.LocalDate;
import java.util.List;

@Component
public class BenchmarkPriceApi {

    private final InfinaClient infinaClient;

    public BenchmarkPriceApi(InfinaClient infinaClient) {
        this.infinaClient = infinaClient;
    }

    public List<IndexPriceRecord> fetchIndexRange(
            String assetCode,
            LocalDate from,
            LocalDate to
    ) {
        return infinaClient.get(
                InfinaEndpoint.INDEX_PRICE,
                rangeParameters(assetCode, from, to),
                IndexPriceRecord.class
        );
    }

    public List<EconomicPriceRecord> fetchEconomicRange(
            String assetCode,
            LocalDate from,
            LocalDate to
    ) {
        return infinaClient.get(
                InfinaEndpoint.ECONOMIC_PRICE,
                rangeParameters(assetCode, from, to),
                EconomicPriceRecord.class
        );
    }

    private MultiValueMap<String, String> rangeParameters(
            String assetCode,
            LocalDate from,
            LocalDate to
    ) {
        MultiValueMap<String, String> parameters = new LinkedMultiValueMap<>();
        parameters.add("asset_code", assetCode);
        parameters.add("data_date", "[" + from + "," + to + "]");
        return parameters;
    }
}
