package com.infina.portfoliomanagement.marketdata.infina.api;

import com.infina.portfoliomanagement.marketdata.infina.client.InfinaClient;
import com.infina.portfoliomanagement.marketdata.infina.client.InfinaEndpoint;
import com.infina.portfoliomanagement.marketdata.infina.dto.TppRateRecord;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.time.LocalDate;
import java.util.List;

@Component
public class TppRateApi {

    private final InfinaClient infinaClient;

    public TppRateApi(InfinaClient infinaClient) {
        this.infinaClient = infinaClient;
    }

    public List<TppRateRecord> fetchRange(String maturityDays, LocalDate from, LocalDate to) {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("day", maturityDays);
        params.add("data_date", "[" + from + "," + to + "]");

        return infinaClient.get(InfinaEndpoint.TPP_RATE, params, TppRateRecord.class);
    }
}
