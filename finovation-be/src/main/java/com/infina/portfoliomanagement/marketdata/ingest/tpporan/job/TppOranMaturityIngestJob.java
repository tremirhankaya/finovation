package com.infina.portfoliomanagement.marketdata.ingest.tpporan.job;

import com.infina.portfoliomanagement.marketdata.csv.CsvFileWriter;
import com.infina.portfoliomanagement.marketdata.csv.RecordCsvMapper;
import com.infina.portfoliomanagement.marketdata.ingest.tpporan.dto.TppOranRecord;
import com.infina.portfoliomanagement.marketdata.ingest.tpporan.service.TppOranService;
import com.infina.portfoliomanagement.marketdata.runner.MarketDataIngestJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Component
public class TppOranMaturityIngestJob implements MarketDataIngestJob {

    private static final Logger log = LoggerFactory.getLogger(TppOranMaturityIngestJob.class);
    private static final Path OUTPUT_DIR = Path.of("data-export", "tpp-oran-vadeler");
    private static final Path OUTPUT_FILE = OUTPUT_DIR.resolve("tpp-oran-vadeler.csv");
    private static final RecordCsvMapper<TppOranRecord> CSV_MAPPER = RecordCsvMapper.of(TppOranRecord.class);

    private final TppOranService tppOranService;
    private final CsvFileWriter csvFileWriter;

    public TppOranMaturityIngestJob(TppOranService tppOranService, CsvFileWriter csvFileWriter) {
        this.tppOranService = tppOranService;
        this.csvFileWriter = csvFileWriter;
    }

    @Override
    public String key() {
        return "tpp-oran-vadeler";
    }

    @Override
    public void run() throws IOException {
        if (Files.exists(OUTPUT_FILE)) {
            log.info("tpp-oran-vadeler: output file already exists, skipping");
            return;
        }

        Files.createDirectories(OUTPUT_DIR);

        List<TppOranRecord> records = tppOranService.fetchAllMaturities();
        csvFileWriter.write(OUTPUT_FILE, CSV_MAPPER.header(), records, CSV_MAPPER::toRow);

        log.info("tpp-oran-vadeler finished: {} rows written", records.size());
    }
}
