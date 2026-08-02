package com.infina.portfoliomanagement.marketdata.ingest.hissereferans.job;

import com.infina.portfoliomanagement.marketdata.runner.MarketDataIngestJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class TickerReferenceExportJob implements MarketDataIngestJob {

    private static final Logger log = LoggerFactory.getLogger(TickerReferenceExportJob.class);
    private static final String RESOURCE_PATH = "data/bist-tickers.csv";
    private static final Path OUTPUT_DIR = Path.of("data-export", "hisse-referans");
    private static final Path OUTPUT_FILE = OUTPUT_DIR.resolve("hisse-referans.csv");

    @Override
    public String key() {
        return "hisse-referans";
    }

    @Override
    public void run() throws IOException {
        if (Files.exists(OUTPUT_FILE)) {
            log.info("hisse-referans: output file already exists, skipping");
            return;
        }

        Files.createDirectories(OUTPUT_DIR);

        try (InputStream in = new ClassPathResource(RESOURCE_PATH).getInputStream()) {
            Files.copy(in, OUTPUT_FILE);
        }

        log.info("hisse-referans finished: {} copied to {}", RESOURCE_PATH, OUTPUT_FILE);
    }
}
