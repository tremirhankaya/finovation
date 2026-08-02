package com.infina.portfoliomanagement.marketdata.csv;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;


@Component
public class TickerCsvReader {

    private static final String RESOURCE_PATH = "data/bist-tickers.csv";
    private static final String ASSET_CODE_COLUMN = "asset_code";

    public List<String> readAssetCodes() {
        List<String> assetCodes = new ArrayList<>();

        try (InputStreamReader reader = new InputStreamReader(
                new ClassPathResource(RESOURCE_PATH).getInputStream(), StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .build()
                     .parse(reader)) {

            for (CSVRecord record : parser) {
                assetCodes.add(record.get(ASSET_CODE_COLUMN));
            }

        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read ticker reference file: " + RESOURCE_PATH, e);
        }

        return assetCodes;
    }
}
