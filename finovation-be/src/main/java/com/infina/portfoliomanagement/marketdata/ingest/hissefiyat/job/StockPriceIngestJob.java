package com.infina.portfoliomanagement.marketdata.ingest.hissefiyat.job;

import com.infina.portfoliomanagement.marketdata.csv.CsvFileWriter;
import com.infina.portfoliomanagement.marketdata.csv.RecordCsvMapper;
import com.infina.portfoliomanagement.marketdata.csv.TickerCsvReader;
import com.infina.portfoliomanagement.marketdata.ingest.hissefiyat.dto.StockPriceRecord;
import com.infina.portfoliomanagement.marketdata.ingest.hissefiyat.service.StockPriceService;
import com.infina.portfoliomanagement.marketdata.ingest.hissetanim.dto.StockDefinitionRecord;
import com.infina.portfoliomanagement.marketdata.ingest.hissetanim.service.TickerValidationService;
import com.infina.portfoliomanagement.marketdata.runner.MarketDataIngestJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

@Component
public class StockPriceIngestJob implements MarketDataIngestJob {

    private static final Logger log = LoggerFactory.getLogger(StockPriceIngestJob.class);
    private static final Path OUTPUT_DIR = Path.of("data-export", "hisse-fiyat");
    private static final RecordCsvMapper<StockPriceRecord> CSV_MAPPER = RecordCsvMapper.of(StockPriceRecord.class);

    private final TickerCsvReader tickerCsvReader;
    private final TickerValidationService tickerValidationService;
    private final StockPriceService stockPriceService;
    private final CsvFileWriter csvFileWriter;

    public StockPriceIngestJob(TickerCsvReader tickerCsvReader,
                                TickerValidationService tickerValidationService,
                                StockPriceService stockPriceService,
                                CsvFileWriter csvFileWriter) {
        this.tickerCsvReader = tickerCsvReader;
        this.tickerValidationService = tickerValidationService;
        this.stockPriceService = stockPriceService;
        this.csvFileWriter = csvFileWriter;
    }

    @Override
    public String key() {
        return "hisse-fiyat";
    }

    @Override
    public void run() throws IOException {
        Files.createDirectories(OUTPUT_DIR);

        List<String> assetCodes = tickerCsvReader.readAssetCodes();
        log.info("hisse-fiyat: {} ticker read", assetCodes.size());

        int written = 0;
        int skippedExisting = 0;
        int skippedInvalid = 0;
        int failed = 0;

        for (String assetCode : assetCodes) {
            Path outputFile = OUTPUT_DIR.resolve(assetCode + ".csv");

            if (Files.exists(outputFile)) {
                log.info("{}: output file already exists, skipping", assetCode);
                skippedExisting++;
                continue;
            }

            try {
                Optional<StockDefinitionRecord> definition = tickerValidationService.validate(assetCode);
                if (definition.isEmpty()) {
                    log.warn("{}: not found/active in /HisseTanim, skipping", assetCode);
                    skippedInvalid++;
                    continue;
                }

                List<StockPriceRecord> prices = stockPriceService.fetchAll(assetCode);
                csvFileWriter.write(outputFile, CSV_MAPPER.header(), prices, CSV_MAPPER::toRow);
                written++;

            } catch (Exception e) {
                log.error("{}: failed, skipping", assetCode, e);
                failed++;
            }
        }

        log.info("hisse-fiyat finished: {} written, {} skipped (existing file), {} skipped (invalid ticker), {} failed",
                written, skippedExisting, skippedInvalid, failed);
    }
}
