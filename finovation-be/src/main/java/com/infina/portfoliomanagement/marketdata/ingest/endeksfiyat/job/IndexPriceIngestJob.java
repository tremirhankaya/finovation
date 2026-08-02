package com.infina.portfoliomanagement.marketdata.ingest.endeksfiyat.job;

import com.infina.portfoliomanagement.marketdata.csv.CsvFileWriter;
import com.infina.portfoliomanagement.marketdata.csv.RecordCsvMapper;
import com.infina.portfoliomanagement.marketdata.ingest.endeksfiyat.dto.IndexPriceRecord;
import com.infina.portfoliomanagement.marketdata.ingest.endeksfiyat.service.IndexPriceService;
import com.infina.portfoliomanagement.marketdata.runner.MarketDataIngestJob;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Slf4j
@Component
public class IndexPriceIngestJob implements MarketDataIngestJob {

    private static final List<String> INDEX_CODES = List.of("XU100", "XU030");
    private static final Path OUTPUT_DIR = Path.of("data-export", "endeks-fiyat");
    private static final RecordCsvMapper<IndexPriceRecord> CSV_MAPPER = RecordCsvMapper.of(IndexPriceRecord.class);

    private final IndexPriceService indexPriceService;
    private final CsvFileWriter csvFileWriter;

    public IndexPriceIngestJob(IndexPriceService indexPriceService, CsvFileWriter csvFileWriter) {
        this.indexPriceService = indexPriceService;
        this.csvFileWriter = csvFileWriter;
    }

    @Override
    public String key() {
        return "endeks-fiyat";
    }

    @Override
    public void run() throws IOException {
        Files.createDirectories(OUTPUT_DIR);

        int written = 0;
        int skippedExisting = 0;
        int failed = 0;

        for (String indexCode : INDEX_CODES) {
            Path outputFile = OUTPUT_DIR.resolve(indexCode + ".csv");

            if (Files.exists(outputFile)) {
                log.info("{}: output file already exists, skipping", indexCode);
                skippedExisting++;
                continue;
            }

            try {
                List<IndexPriceRecord> prices = indexPriceService.fetchAll(indexCode);
                csvFileWriter.write(outputFile, CSV_MAPPER.header(), prices, CSV_MAPPER::toRow);
                written++;
            } catch (Exception e) {
                log.error("{}: failed, skipping", indexCode, e);
                failed++;
            }
        }

        log.info("endeks-fiyat finished: {} written, {} skipped (existing file), {} failed",
                written, skippedExisting, failed);
    }
}
