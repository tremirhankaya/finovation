package com.infina.portfoliomanagement.marketdata.ingest.tpporan.job;

import com.infina.portfoliomanagement.marketdata.csv.CsvFileWriter;
import com.infina.portfoliomanagement.marketdata.csv.RecordCsvMapper;
import com.infina.portfoliomanagement.marketdata.ingest.tpporan.dto.TppOranRecord;
import com.infina.portfoliomanagement.marketdata.ingest.tpporan.service.TppOranForwardFiller;
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
public class TppOranIngestJob implements MarketDataIngestJob {

    private static final Logger log = LoggerFactory.getLogger(TppOranIngestJob.class);
    private static final Path OUTPUT_DIR = Path.of("data-export", "tpp-oran");
    private static final Path OUTPUT_FILE = OUTPUT_DIR.resolve("tpp-oran.csv");
    private static final RecordCsvMapper<TppOranRecord> CSV_MAPPER = RecordCsvMapper.of(TppOranRecord.class);

    private final TppOranService tppOranService;
    private final TppOranForwardFiller forwardFiller;
    private final CsvFileWriter csvFileWriter;

    public TppOranIngestJob(TppOranService tppOranService, TppOranForwardFiller forwardFiller, CsvFileWriter csvFileWriter) {
        this.tppOranService = tppOranService;
        this.forwardFiller = forwardFiller;
        this.csvFileWriter = csvFileWriter;
    }

    @Override
    public String key() {
        return "tpp-oran";
    }

    @Override
    public void run() throws IOException {
        if (Files.exists(OUTPUT_FILE)) {
            log.info("tpp-oran: output file already exists, skipping");
            return;
        }

        Files.createDirectories(OUTPUT_DIR);

        List<TppOranRecord> records = tppOranService.fetchAll();
        log.info("tpp-oran: {} trading day records read", records.size());

        List<TppOranRecord> filled = forwardFiller.fill(records);
        csvFileWriter.write(OUTPUT_FILE, CSV_MAPPER.header(), filled, CSV_MAPPER::toRow);

        log.info("tpp-oran finished: {} calendar days written ({} actual trading days, {} forward-filled)",
                filled.size(), records.size(), filled.size() - records.size());
    }
}
