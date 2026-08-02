package com.infina.portfoliomanagement.marketdata.ingest.hissetanim.service;

import com.infina.portfoliomanagement.marketdata.client.InfinaClient;
import com.infina.portfoliomanagement.marketdata.client.InfinaEndpoints;
import com.infina.portfoliomanagement.marketdata.ingest.hissetanim.dto.StockDefinitionRecord;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.List;
import java.util.Optional;

@Service
public class TickerValidationService {

    private final InfinaClient infinaClient;

    public TickerValidationService(InfinaClient infinaClient) {
        this.infinaClient = infinaClient;
    }

    public Optional<StockDefinitionRecord> validate(String assetCode) {
        String code = assetCode.contains(".")
                ? assetCode.substring(0, assetCode.indexOf('.'))
                : assetCode;

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("code", code);

        List<StockDefinitionRecord> records = infinaClient.get(InfinaEndpoints.STOCK_DEFINITION, params, StockDefinitionRecord.class);

        return records.stream()
                .filter(r -> "E".equals(r.security()))
                .filter(r -> "ACTIVE".equals(r.status()))
                .findFirst();
    }
}
