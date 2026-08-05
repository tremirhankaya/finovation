package com.infina.portfoliomanagement.marketdata.infina.api;

import com.infina.portfoliomanagement.marketdata.infina.client.InfinaClient;
import com.infina.portfoliomanagement.marketdata.infina.client.InfinaEndpoint;
import com.infina.portfoliomanagement.marketdata.infina.dto.EquityPriceRecord;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.time.LocalDate;
import java.util.List;

@Component
public class EquityPriceApi {

    private final InfinaClient infinaClient;

    public EquityPriceApi(InfinaClient infinaClient) {
        this.infinaClient = infinaClient;
    }

    public List<EquityPriceRecord> fetchRange(String assetCode, LocalDate from, LocalDate to) {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("asset_code", assetCode);
        params.add("data_date", "[" + from + "," + to + "]");

        return infinaClient.get(InfinaEndpoint.STOCK_PRICE, params, EquityPriceRecord.class);
    }
}
