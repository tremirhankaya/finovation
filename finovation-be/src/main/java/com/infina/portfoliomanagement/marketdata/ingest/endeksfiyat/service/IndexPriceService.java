package com.infina.portfoliomanagement.marketdata.ingest.endeksfiyat.service;

import com.infina.portfoliomanagement.marketdata.client.HistoricalDataFetcher;
import com.infina.portfoliomanagement.marketdata.client.InfinaEndpoints;
import com.infina.portfoliomanagement.marketdata.ingest.endeksfiyat.dto.IndexPriceRecord;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class IndexPriceService {

    private final HistoricalDataFetcher historicalDataFetcher;

    public IndexPriceService(HistoricalDataFetcher historicalDataFetcher) {
        this.historicalDataFetcher = historicalDataFetcher;
    }

    public List<IndexPriceRecord> fetchAll(String assetCode) {
        return historicalDataFetcher.fetchAll(
                InfinaEndpoints.INDEX_PRICE,
                IndexPriceRecord.class,
                assetCode,
                IndexPriceRecord::dataDate
        );
    }
}
