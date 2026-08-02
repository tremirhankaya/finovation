package com.infina.portfoliomanagement.marketdata.ingest.sermayeartirim.service;

import com.infina.portfoliomanagement.marketdata.client.HistoricalDataFetcher;
import com.infina.portfoliomanagement.marketdata.client.InfinaEndpoints;
import com.infina.portfoliomanagement.marketdata.ingest.sermayeartirim.dto.CapitalIncreaseRecord;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.List;

@Service
public class CapitalIncreaseService {

    private final HistoricalDataFetcher historicalDataFetcher;

    public CapitalIncreaseService(HistoricalDataFetcher historicalDataFetcher) {
        this.historicalDataFetcher = historicalDataFetcher;
    }

    public List<CapitalIncreaseRecord> fetchAll(String assetCode) {
        String code = assetCode + ".BIST";

        MultiValueMap<String, String> extraParams = new LinkedMultiValueMap<>();
        extraParams.add("code", code);

        return historicalDataFetcher.fetchAll(
                InfinaEndpoints.CAPITAL_INCREASE,
                CapitalIncreaseRecord.class,
                assetCode,
                extraParams,
                CapitalIncreaseRecord::dataDate
        );
    }
}
