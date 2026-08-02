package com.infina.portfoliomanagement.marketdata.ingest.tatilgunleri.service;

import com.infina.portfoliomanagement.marketdata.client.HistoricalDataFetcher;
import com.infina.portfoliomanagement.marketdata.client.InfinaEndpoints;
import com.infina.portfoliomanagement.marketdata.ingest.tatilgunleri.dto.HolidayRecord;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.List;

@Service
public class HolidayService {

    private static final String LOG_LABEL = "tatil-gunleri";

    private final HistoricalDataFetcher historicalDataFetcher;

    public HolidayService(HistoricalDataFetcher historicalDataFetcher) {
        this.historicalDataFetcher = historicalDataFetcher;
    }

    public List<HolidayRecord> fetchAll() {
        return historicalDataFetcher.fetchAll(
                InfinaEndpoints.HOLIDAYS,
                HolidayRecord.class,
                LOG_LABEL,
                new LinkedMultiValueMap<>(),
                HolidayRecord::dataDate
        );
    }
}
