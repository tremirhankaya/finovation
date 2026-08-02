package com.infina.portfoliomanagement.marketdata.ingest.hissefiyat.service;

import com.infina.portfoliomanagement.marketdata.client.HistoricalDataFetcher;
import com.infina.portfoliomanagement.marketdata.client.InfinaEndpoints;
import com.infina.portfoliomanagement.marketdata.ingest.hissefiyat.dto.StockPriceRecord;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class StockPriceService {

    private final HistoricalDataFetcher historicalDataFetcher;

    public StockPriceService(HistoricalDataFetcher historicalDataFetcher) {
        this.historicalDataFetcher = historicalDataFetcher;
    }

    public List<StockPriceRecord> fetchAll(String assetCode) {
        return historicalDataFetcher.fetchAll(
                InfinaEndpoints.STOCK_PRICE,
                StockPriceRecord.class,
                assetCode,
                StockPriceRecord::dataDate
        );
    }

    public List<StockPriceRecord> fetchAll(String assetCode, LocalDate from, LocalDate to) {
        return historicalDataFetcher.fetchAll(
                InfinaEndpoints.STOCK_PRICE,
                StockPriceRecord.class,
                assetCode,
                StockPriceRecord::dataDate,
                from,
                to
        );
    }
}
