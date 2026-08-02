package com.infina.portfoliomanagement.marketdata.ingest.tpporan.service;

import com.infina.portfoliomanagement.marketdata.client.HistoricalDataFetcher;
import com.infina.portfoliomanagement.marketdata.client.InfinaEndpoints;
import com.infina.portfoliomanagement.marketdata.ingest.tpporan.dto.TppOranRecord;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.List;

@Service
public class TppOranService {

    private static final String OVERNIGHT_DAY = "1";
    private static final String LOG_LABEL = "tpp-oran (overnight)";

    private final HistoricalDataFetcher historicalDataFetcher;

    public TppOranService(HistoricalDataFetcher historicalDataFetcher) {
        this.historicalDataFetcher = historicalDataFetcher;
    }

    public List<TppOranRecord> fetchAll() {
        MultiValueMap<String, String> extraParams = new LinkedMultiValueMap<>();
        extraParams.add("day", OVERNIGHT_DAY);

        return historicalDataFetcher.fetchAll(
                InfinaEndpoints.TPP_RATE,
                TppOranRecord.class,
                LOG_LABEL,
                extraParams,
                TppOranRecord::dataDate
        );
    }

    public List<TppOranRecord> fetchAllMaturities() {
        return historicalDataFetcher.fetchAll(
                InfinaEndpoints.TPP_RATE,
                TppOranRecord.class,
                "tpp-oran (tüm vadeler)",
                new LinkedMultiValueMap<>(),
                TppOranRecord::dataDate
        );
    }
}
