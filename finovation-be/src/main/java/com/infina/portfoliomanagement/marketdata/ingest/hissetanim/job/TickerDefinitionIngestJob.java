package com.infina.portfoliomanagement.marketdata.ingest.hissetanim.job;

import com.infina.portfoliomanagement.marketdata.csv.CsvFileWriter;
import com.infina.portfoliomanagement.marketdata.csv.RecordCsvMapper;
import com.infina.portfoliomanagement.marketdata.csv.TickerCsvReader;
import com.infina.portfoliomanagement.marketdata.ingest.hissetanim.dto.StockDefinitionRecord;
import com.infina.portfoliomanagement.marketdata.ingest.hissetanim.service.TickerValidationService;
import com.infina.portfoliomanagement.marketdata.runner.MarketDataIngestJob;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
public class TickerDefinitionIngestJob implements MarketDataIngestJob {

    private static final Path OUTPUT_DIR = Path.of("data-export", "hisse-tanim");
    private static final Path OUTPUT_FILE = OUTPUT_DIR.resolve("hisse-tanim.csv");
    private static final RecordCsvMapper<StockDefinitionRecord> CSV_MAPPER = RecordCsvMapper.of(StockDefinitionRecord.class);

    private final TickerCsvReader tickerCsvReader;
    private final TickerValidationService tickerValidationService;
    private final CsvFileWriter csvFileWriter;

    public TickerDefinitionIngestJob(TickerCsvReader tickerCsvReader,
                                      TickerValidationService tickerValidationService,
                                      CsvFileWriter csvFileWriter) {
        this.tickerCsvReader = tickerCsvReader;
        this.tickerValidationService = tickerValidationService;
        this.csvFileWriter = csvFileWriter;
    }

    @Override
    public String key() {
        return "hisse-tanim";
    }

    @Override
    public void run() throws IOException {
        if (Files.exists(OUTPUT_FILE)) {
            log.info("hisse-tanim: output file already exists, skipping");
            return;
        }

        Files.createDirectories(OUTPUT_DIR);

        List<String> assetCodes = tickerCsvReader.readAssetCodes();
        log.info("hisse-tanim: {} ticker read", assetCodes.size());

        List<StockDefinitionRecord> definitions = new ArrayList<>();
        int skippedInvalid = 0;
        int failed = 0;

        for (String assetCode : assetCodes) {
            try {
                Optional<StockDefinitionRecord> definition = tickerValidationService.validate(assetCode);
                if (definition.isEmpty()) {
                    log.warn("{}: not found/active in /HisseTanim, skipping", assetCode);
                    skippedInvalid++;
                    continue;
                }
                definitions.add(definition.get());

            } catch (Exception e) {
                log.error("{}: failed, skipping", assetCode, e);
                failed++;
            }
        }

        csvFileWriter.write(OUTPUT_FILE, CSV_MAPPER.header(), definitions, CSV_MAPPER::toRow);

        log.info("hisse-tanim finished: {} written, {} skipped (invalid ticker), {} failed",
                definitions.size(), skippedInvalid, failed);
    }
}
