package com.infina.portfoliomanagement.marketdata.ingest.dovizfiyat.service;

import com.infina.portfoliomanagement.marketdata.client.HistoricalDataFetcher;
import com.infina.portfoliomanagement.marketdata.client.InfinaEndpoints;
import com.infina.portfoliomanagement.marketdata.ingest.dovizfiyat.dto.ForexRateRecord;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ForexRateService {

    private final HistoricalDataFetcher historicalDataFetcher;

    public ForexRateService(HistoricalDataFetcher historicalDataFetcher) {
        this.historicalDataFetcher = historicalDataFetcher;
    }

    public List<ForexRateRecord> fetchAll(String assetCode) {
        return historicalDataFetcher.fetchAll(
                InfinaEndpoints.FOREX_RATE,
                ForexRateRecord.class,
                assetCode,
                ForexRateRecord::dataDate
        );
    }
}
