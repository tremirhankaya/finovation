package com.infina.portfoliomanagement.marketdata.ingest.dovizfiyat.job;

import com.infina.portfoliomanagement.marketdata.csv.CsvFileWriter;
import com.infina.portfoliomanagement.marketdata.csv.RecordCsvMapper;
import com.infina.portfoliomanagement.marketdata.ingest.dovizfiyat.dto.ForexRateRecord;
import com.infina.portfoliomanagement.marketdata.ingest.dovizfiyat.service.ForexRateService;
import com.infina.portfoliomanagement.marketdata.runner.MarketDataIngestJob;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Slf4j
@Component
public class ForexRateIngestJob implements MarketDataIngestJob {

    private static final List<String> CURRENCY_PAIRS = List.of("USD/TRY", "EUR/TRY", "GBP/TRY");
    private static final Path OUTPUT_DIR = Path.of("data-export", "doviz-fiyat");
    private static final RecordCsvMapper<ForexRateRecord> CSV_MAPPER = RecordCsvMapper.of(ForexRateRecord.class);

    private final ForexRateService forexRateService;
    private final CsvFileWriter csvFileWriter;

    public ForexRateIngestJob(ForexRateService forexRateService, CsvFileWriter csvFileWriter) {
        this.forexRateService = forexRateService;
        this.csvFileWriter = csvFileWriter;
    }

    @Override
    public String key() {
        return "doviz-fiyat";
    }

    @Override
    public void run() throws IOException {
        Files.createDirectories(OUTPUT_DIR);

        int written = 0;
        int skippedExisting = 0;
        int failed = 0;

        for (String currencyPair : CURRENCY_PAIRS) {
            Path outputFile = OUTPUT_DIR.resolve(fileName(currencyPair));

            if (Files.exists(outputFile)) {
                log.info("{}: output file already exists, skipping", currencyPair);
                skippedExisting++;
                continue;
            }

            try {
                List<ForexRateRecord> rates = forexRateService.fetchAll(currencyPair);
                csvFileWriter.write(outputFile, CSV_MAPPER.header(), rates, CSV_MAPPER::toRow);
                written++;
            } catch (Exception e) {
                log.error("{}: failed, skipping", currencyPair, e);
                failed++;
            }
        }

        log.info("doviz-fiyat finished: {} written, {} skipped (existing file), {} failed",
                written, skippedExisting, failed);
    }

    private String fileName(String currencyPair) {
        return currencyPair.replace("/", "-") + ".csv";
    }
}
