package com.infina.portfoliomanagement.marketdata.ingest.sermayeartirim.job;

import com.infina.portfoliomanagement.marketdata.csv.CsvFileWriter;
import com.infina.portfoliomanagement.marketdata.csv.RecordCsvMapper;
import com.infina.portfoliomanagement.marketdata.csv.TickerCsvReader;
import com.infina.portfoliomanagement.marketdata.ingest.sermayeartirim.dto.CapitalIncreaseRecord;
import com.infina.portfoliomanagement.marketdata.ingest.sermayeartirim.service.CapitalIncreaseService;
import com.infina.portfoliomanagement.marketdata.runner.MarketDataIngestJob;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Slf4j
@Component
public class CapitalIncreaseIngestJob implements MarketDataIngestJob {

    private static final Path OUTPUT_DIR = Path.of("data-export", "sermaye-artirim");
    private static final RecordCsvMapper<CapitalIncreaseRecord> CSV_MAPPER = RecordCsvMapper.of(CapitalIncreaseRecord.class);

    private final TickerCsvReader tickerCsvReader;
    private final CapitalIncreaseService capitalIncreaseService;
    private final CsvFileWriter csvFileWriter;

    public CapitalIncreaseIngestJob(TickerCsvReader tickerCsvReader,
                                     CapitalIncreaseService capitalIncreaseService,
                                     CsvFileWriter csvFileWriter) {
        this.tickerCsvReader = tickerCsvReader;
        this.capitalIncreaseService = capitalIncreaseService;
        this.csvFileWriter = csvFileWriter;
    }

    @Override
    public String key() {
        return "sermaye-artirim";
    }

    @Override
    public void run() throws IOException {
        Files.createDirectories(OUTPUT_DIR);

        List<String> assetCodes = tickerCsvReader.readAssetCodes();
        log.info("sermaye-artirim: {} ticker read", assetCodes.size());

        int written = 0;
        int skippedExisting = 0;
        int failed = 0;

        for (String assetCode : assetCodes) {
            Path outputFile = OUTPUT_DIR.resolve(assetCode + ".csv");

            if (Files.exists(outputFile)) {
                log.info("{}: output file already exists, skipping", assetCode);
                skippedExisting++;
                continue;
            }

            try {
                List<CapitalIncreaseRecord> events = capitalIncreaseService.fetchAll(assetCode);
                csvFileWriter.write(outputFile, CSV_MAPPER.header(), events, CSV_MAPPER::toRow);
                written++;
            } catch (Exception e) {
                log.error("{}: failed, skipping", assetCode, e);
                failed++;
            }
        }

        log.info("sermaye-artirim finished: {} written, {} skipped (existing file), {} failed",
                written, skippedExisting, failed);
    }
}
