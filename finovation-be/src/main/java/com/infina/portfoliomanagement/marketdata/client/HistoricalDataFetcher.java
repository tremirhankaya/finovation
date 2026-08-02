package com.infina.portfoliomanagement.marketdata.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.time.LocalDate;
import java.util.List;
import java.util.function.Function;


@Component
public class HistoricalDataFetcher {

    private static final Logger log = LoggerFactory.getLogger(HistoricalDataFetcher.class);
    private static final LocalDate EARLIEST_DATE = LocalDate.of(1990, 1, 1);

    private final InfinaClient infinaClient;

    public HistoricalDataFetcher(InfinaClient infinaClient) {
        this.infinaClient = infinaClient;
    }

    public <T> List<T> fetchAll(String endpoint, Class<T> type, String assetCode, Function<T, LocalDate> dateExtractor) {
        return fetchAll(endpoint, type, assetCode, dateExtractor, EARLIEST_DATE, LocalDate.now());
    }

    public <T> List<T> fetchAll(String endpoint, Class<T> type, String assetCode, Function<T, LocalDate> dateExtractor,
                                 LocalDate from, LocalDate to) {
        MultiValueMap<String, String> extraParams = new LinkedMultiValueMap<>();
        extraParams.add("asset_code", assetCode);
        return fetchAll(endpoint, type, assetCode, extraParams, dateExtractor, from, to);
    }

    public <T> List<T> fetchAll(String endpoint, Class<T> type, String label, MultiValueMap<String, String> extraParams,
                                 Function<T, LocalDate> dateExtractor) {
        return fetchAll(endpoint, type, label, extraParams, dateExtractor, EARLIEST_DATE, LocalDate.now());
    }

    public <T> List<T> fetchAll(String endpoint, Class<T> type, String label, MultiValueMap<String, String> extraParams,
                                 Function<T, LocalDate> dateExtractor, LocalDate from, LocalDate to) {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>(extraParams);
        params.add("data_date", "[%s,%s]".formatted(from, to));

        List<T> records = infinaClient.get(endpoint, params, type);
        logSummary(endpoint, label, records, dateExtractor);
        return records;
    }

    private <T> void logSummary(String endpoint, String label, List<T> records, Function<T, LocalDate> dateExtractor) {
        if (records.isEmpty()) {
            log.warn("{}: no records returned from {}", label, endpoint);
            return;
        }

        LocalDate earliestDate = records.stream()
                .map(dateExtractor)
                .min(LocalDate::compareTo)
                .orElseThrow();

        log.info("{}: {} records from {} (earliest date: {})", label, records.size(), endpoint, earliestDate);
    }
}
