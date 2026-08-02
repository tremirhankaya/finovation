package com.infina.portfoliomanagement.marketdata.ingest.tatilgunleri.job;

import com.infina.portfoliomanagement.marketdata.csv.CsvFileWriter;
import com.infina.portfoliomanagement.marketdata.csv.RecordCsvMapper;
import com.infina.portfoliomanagement.marketdata.ingest.tatilgunleri.dto.HolidayRecord;
import com.infina.portfoliomanagement.marketdata.ingest.tatilgunleri.service.HolidayService;
import com.infina.portfoliomanagement.marketdata.runner.MarketDataIngestJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Component
public class HolidayIngestJob implements MarketDataIngestJob {

    private static final Logger log = LoggerFactory.getLogger(HolidayIngestJob.class);
    private static final Path OUTPUT_DIR = Path.of("data-export", "tatil-gunleri");
    private static final Path OUTPUT_FILE = OUTPUT_DIR.resolve("tatil-gunleri.csv");
    private static final RecordCsvMapper<HolidayRecord> CSV_MAPPER = RecordCsvMapper.of(HolidayRecord.class);

    private final HolidayService holidayService;
    private final CsvFileWriter csvFileWriter;

    public HolidayIngestJob(HolidayService holidayService, CsvFileWriter csvFileWriter) {
        this.holidayService = holidayService;
        this.csvFileWriter = csvFileWriter;
    }

    @Override
    public String key() {
        return "tatil-gunleri";
    }

    @Override
    public void run() throws IOException {
        if (Files.exists(OUTPUT_FILE)) {
            log.info("tatil-gunleri: output file already exists, skipping");
            return;
        }

        Files.createDirectories(OUTPUT_DIR);

        List<HolidayRecord> holidays = holidayService.fetchAll();
        csvFileWriter.write(OUTPUT_FILE, CSV_MAPPER.header(), holidays, CSV_MAPPER::toRow);

        log.info("tatil-gunleri finished: {} holidays written", holidays.size());
    }
}
