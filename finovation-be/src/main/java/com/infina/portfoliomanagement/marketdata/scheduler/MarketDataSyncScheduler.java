package com.infina.portfoliomanagement.marketdata.scheduler;

import com.infina.portfoliomanagement.marketdata.service.equity.definition.EquityDefinitionSyncService;
import com.infina.portfoliomanagement.marketdata.service.equity.price.EquityPriceSyncService;
import com.infina.portfoliomanagement.marketdata.service.sector.SectorSyncService;
import com.infina.portfoliomanagement.marketdata.service.tpp.TppRateSyncService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.time.Instant;

@Slf4j
@Component
@ConditionalOnProperty(prefix = "marketdata.sync", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MarketDataSyncScheduler {

    private final SectorSyncService sectorSyncService;
    private final EquityDefinitionSyncService equityDefinitionSyncService;
    private final EquityPriceSyncService equityPriceSyncService;
    private final TppRateSyncService tppRateSyncService;
    private final TaskScheduler taskScheduler;
    private final boolean bootstrapOnStartup;

    public MarketDataSyncScheduler(SectorSyncService sectorSyncService,
                                   EquityDefinitionSyncService equityDefinitionSyncService,
                                   EquityPriceSyncService equityPriceSyncService,
                                   TppRateSyncService tppRateSyncService,
                                   TaskScheduler taskScheduler,
                                   @Value("${marketdata.sync.bootstrap-on-startup:true}") boolean bootstrapOnStartup) {
        this.sectorSyncService = sectorSyncService;
        this.equityDefinitionSyncService = equityDefinitionSyncService;
        this.equityPriceSyncService = equityPriceSyncService;
        this.tppRateSyncService = tppRateSyncService;
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

        try {
            tppRateSyncService.sync();
        } catch (Exception e) {
            log.error("tpp rate bootstrap failed", e);
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

        try {
            tppRateSyncService.sync();
        } catch (Exception e) {
            log.error("tpp rate sync failed", e);
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
