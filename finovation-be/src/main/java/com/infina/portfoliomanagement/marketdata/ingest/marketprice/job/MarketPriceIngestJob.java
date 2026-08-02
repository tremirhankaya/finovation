package com.infina.portfoliomanagement.marketdata.ingest.marketprice.job;

import com.infina.portfoliomanagement.marketdata.csv.CsvFileWriter;
import com.infina.portfoliomanagement.marketdata.csv.RecordCsvMapper;
import com.infina.portfoliomanagement.marketdata.ingest.marketprice.dto.MarketPriceRecord;
import com.infina.portfoliomanagement.marketdata.ingest.marketprice.service.MarketPriceService;
import com.infina.portfoliomanagement.marketdata.runner.MarketDataIngestJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Component
public class MarketPriceIngestJob implements MarketDataIngestJob {

    private static final Logger log = LoggerFactory.getLogger(MarketPriceIngestJob.class);
    private static final List<String> ASSET_CODES = List.of("XAUUSD", "XAGUSD");
    private static final Path OUTPUT_DIR = Path.of("data-export", "market-price");
    private static final RecordCsvMapper<MarketPriceRecord> CSV_MAPPER = RecordCsvMapper.of(MarketPriceRecord.class);

    private final MarketPriceService marketPriceService;
    private final CsvFileWriter csvFileWriter;

    public MarketPriceIngestJob(MarketPriceService marketPriceService, CsvFileWriter csvFileWriter) {
        this.marketPriceService = marketPriceService;
        this.csvFileWriter = csvFileWriter;
    }

    @Override
    public String key() {
        return "market-price";
    }

    @Override
    public void run() throws IOException {
        Files.createDirectories(OUTPUT_DIR);

        int written = 0;
        int skippedExisting = 0;
        int failed = 0;

        for (String assetCode : ASSET_CODES) {
            Path outputFile = OUTPUT_DIR.resolve(fileName(assetCode));

            if (Files.exists(outputFile)) {
                log.info("{}: output file already exists, skipping", assetCode);
                skippedExisting++;
                continue;
            }

            try {
                List<MarketPriceRecord> prices = marketPriceService.fetchAll(assetCode);
                csvFileWriter.write(outputFile, CSV_MAPPER.header(), prices, CSV_MAPPER::toRow);
                written++;
            } catch (Exception e) {
                log.error("{}: failed, skipping", assetCode, e);
                failed++;
            }
        }

        log.info("market-price finished: {} written, {} skipped (existing file), {} failed",
                written, skippedExisting, failed);
    }

    private String fileName(String assetCode) {
        return assetCode.replace("/", "-") + ".csv";
    }
}
