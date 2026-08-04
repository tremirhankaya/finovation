package com.infina.portfoliomanagement.marketdata.scheduler;

import com.infina.portfoliomanagement.marketdata.service.equity.definition.EquityDefinitionSyncService;
import com.infina.portfoliomanagement.marketdata.service.equity.price.EquityPriceSyncService;
import com.infina.portfoliomanagement.marketdata.service.sector.SectorSyncService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
public class MarketDataSyncScheduler {

    private final SectorSyncService sectorSyncService;
    private final EquityDefinitionSyncService equityDefinitionSyncService;
    private final EquityPriceSyncService equityPriceSyncService;
    private final TaskScheduler taskScheduler;
    private final boolean bootstrapOnStartup;

    public MarketDataSyncScheduler(SectorSyncService sectorSyncService,
                                   EquityDefinitionSyncService equityDefinitionSyncService,
                                   EquityPriceSyncService equityPriceSyncService,
                                   TaskScheduler taskScheduler,
                                   @Value("${marketdata.sync.bootstrap-on-startup:true}") boolean bootstrapOnStartup) {
        this.sectorSyncService = sectorSyncService;
        this.equityDefinitionSyncService = equityDefinitionSyncService;
        this.equityPriceSyncService = equityPriceSyncService;
        this.taskScheduler = taskScheduler;
        this.bootstrapOnStartup = bootstrapOnStartup;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!bootstrapOnStartup) {
            log.info("market data bootstrap is disabled");
            return;
        }

        log.info("market data bootstrap scheduled to run in the background");
        taskScheduler.schedule(this::bootstrap, Instant.now());
    }

    private void bootstrap() {
        log.info("market data bootstrap started");

        try {
            sectorSyncService.sync();
        } catch (Exception e) {
            log.error("sector bootstrap failed", e);
        }

        try {
            equityDefinitionSyncService.sync();
        } catch (Exception e) {
            log.error("equity definition bootstrap failed", e);
        }

        try {
            equityPriceSyncService.sync();
        } catch (Exception e) {
            log.error("equity price bootstrap failed", e);
        }

        log.info("market data bootstrap finished");
    }

    @Scheduled(cron = "${marketdata.sync.reference-cron}", zone = "Europe/Istanbul")
    public void syncReferenceData() {
        log.info("reference sync started");

        try {
            sectorSyncService.sync();
        } catch (Exception e) {
            log.error("sector sync failed", e);
        }

        try {
            equityDefinitionSyncService.sync();
        } catch (Exception e) {
            log.error("equity definition sync failed", e);
        }

        log.info("reference sync finished");
    }

    @Scheduled(cron = "${marketdata.sync.price-cron}", zone = "Europe/Istanbul")
    public void syncPrices() {
        try {
            equityPriceSyncService.sync();
        } catch (Exception e) {
            log.error("equity price sync failed", e);
        }
    }

    @Scheduled(cron = "${marketdata.sync.price-deep-refresh-cron}", zone = "Europe/Istanbul")
    public void deepRefreshPrices() {
        try {
            equityPriceSyncService.deepRefresh();
        } catch (Exception e) {
            log.error("equity price deep refresh failed", e);
        }
    }
}
