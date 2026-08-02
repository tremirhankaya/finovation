package com.infina.portfoliomanagement.marketdata.runner;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@Profile("data-ingest")
public class MarketDataIngestRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MarketDataIngestRunner.class);
    private static final String ALL_JOBS_ARG = "all";

    private final Map<String, MarketDataIngestJob> jobsByKey;
    private final ConfigurableApplicationContext applicationContext;

    public MarketDataIngestRunner(List<MarketDataIngestJob> jobs, ConfigurableApplicationContext applicationContext) {
        this.jobsByKey = jobs.stream().collect(Collectors.toMap(MarketDataIngestJob::key, Function.identity()));
        this.applicationContext = applicationContext;
    }

    @Override
    public void run(String... args) {
        Set<String> requestedKeys = resolveRequestedKeys(args);

        if (requestedKeys.isEmpty()) {
            log.error("No job specified. Available jobs: {} (or '{}' to run every job)", jobsByKey.keySet(), ALL_JOBS_ARG);
            exit(1);
            return;
        }

        int failed = 0;
        for (String key : requestedKeys) {
            MarketDataIngestJob job = jobsByKey.get(key);
            if (job == null) {
                log.error("Unknown job: '{}'. Available jobs: {}", key, jobsByKey.keySet());
                failed++;
                continue;
            }

            try {
                job.run();
            } catch (Exception e) {
                log.error("{}: job failed", key, e);
                failed++;
            }
        }

        exit(failed == 0 ? 0 : 1);
    }

    private Set<String> resolveRequestedKeys(String[] args) {
        if (args.length == 1 && ALL_JOBS_ARG.equalsIgnoreCase(args[0])) {
            return jobsByKey.keySet();
        }
        return new LinkedHashSet<>(List.of(args));
    }

    private void exit(int status) {
        System.exit(SpringApplication.exit(applicationContext, () -> status));
    }
}
