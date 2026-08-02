package com.infina.portfoliomanagement.marketdata.ingest.marketprice.service;

import com.infina.portfoliomanagement.marketdata.client.HistoricalDataFetcher;
import com.infina.portfoliomanagement.marketdata.client.InfinaEndpoints;
import com.infina.portfoliomanagement.marketdata.ingest.marketprice.dto.MarketPriceRecord;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MarketPriceService {

    private final HistoricalDataFetcher historicalDataFetcher;

    public MarketPriceService(HistoricalDataFetcher historicalDataFetcher) {
        this.historicalDataFetcher = historicalDataFetcher;
    }

    public List<MarketPriceRecord> fetchAll(String assetCode) {
        return historicalDataFetcher.fetchAll(
                InfinaEndpoints.MARKET_PRICE,
                MarketPriceRecord.class,
                assetCode,
                MarketPriceRecord::dataDate
        );
    }
}
