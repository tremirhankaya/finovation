package com.infina.portfoliomanagement.marketdata.service.equity.price;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityPrice;
import com.infina.portfoliomanagement.marketdata.enums.AssetType;
import com.infina.portfoliomanagement.marketdata.infina.api.EquityPriceApi;
import com.infina.portfoliomanagement.marketdata.infina.dto.EquityPriceRecord;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityPriceRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class EquityPriceSyncService {

    private final EquityPriceApi equityPriceApi;
    private final AssetRepository assetRepository;
    private final EquityPriceRepository equityPriceRepository;
    private final EquityPriceChangeCollector changeCollector;
    private final EquityPriceWriter priceWriter;
    private final Clock clock;
    private final int lookbackDays;
    private final int deepLookbackDays;
    private final LocalDate historyStart;

    public EquityPriceSyncService(EquityPriceApi equityPriceApi,
                                  AssetRepository assetRepository,
                                  EquityPriceRepository equityPriceRepository,
                                  EquityPriceChangeCollector changeCollector,
                                  EquityPriceWriter priceWriter,
                                  Clock clock,
                                  @Value("${marketdata.sync.price-lookback-days:30}") int lookbackDays,
                                  @Value("${marketdata.sync.price-deep-lookback-days:365}") int deepLookbackDays,
                                  @Value("${marketdata.sync.price-history-start:1990-01-01}") String historyStart) {
        this.equityPriceApi = equityPriceApi;
        this.assetRepository = assetRepository;
        this.equityPriceRepository = equityPriceRepository;
        this.changeCollector = changeCollector;
        this.priceWriter = priceWriter;
        this.clock = clock;
        this.lookbackDays = lookbackDays;
        this.deepLookbackDays = deepLookbackDays;
        this.historyStart = LocalDate.parse(historyStart);
    }

    public void sync() {
        run("price sync", lookbackDays);
    }

    public void deepRefresh() {
        run("price deep refresh", deepLookbackDays);
    }

    private void run(String label, int lookback) {
        List<Asset> equities = assetRepository.findAllByAssetTypeAndActiveTrueOrderByAssetCodeAsc(AssetType.EQUITY);
        LocalDate today = LocalDate.now(clock);

        log.info("{} started: {} asset(s)", label, equities.size());

        int inserted = 0;
        int updated = 0;
        int failed = 0;

        for (Asset asset : equities) {
            try {
                LocalDate from = resolveStartDate(asset, lookback);

                if (from.isAfter(today)) {
                    continue;
                }

                PriceChanges changes = syncAsset(asset, from, today);
                inserted += changes.insertedCount();
                updated += changes.updatedCount();
            } catch (Exception e) {
                log.error("{}: price sync failed", asset.getAssetCode(), e);
                failed++;
            }
        }

        log.info("{} finished: {} inserted, {} updated, {} failed", label, inserted, updated, failed);
    }

    private LocalDate resolveStartDate(Asset asset, int lookback) {
        Optional<EquityPrice> latest = equityPriceRepository.findTopByAssetIdOrderByDataDateDesc(asset.getId());

        if (latest.isEmpty()) {
            return historyStart;
        }

        return latest.get().getDataDate().minusDays(lookback);
    }

    private PriceChanges syncAsset(Asset asset, LocalDate from, LocalDate to) {
        List<EquityPriceRecord> records = equityPriceApi.fetchRange(asset.getAssetCode(), from, to);

        if (records.isEmpty()) {
            log.warn("{}: no price data returned for {} - {}", asset.getAssetCode(), from, to);
            return PriceChanges.none();
        }

        Map<LocalDate, EquityPrice> existingByDate = loadExisting(asset, from, to);
        PriceChanges changes = changeCollector.collect(asset, records, existingByDate, LocalDateTime.now(clock));

        if (!changes.isEmpty()) {
            priceWriter.write(changes);
        }

        return changes;
    }

    private Map<LocalDate, EquityPrice> loadExisting(Asset asset, LocalDate from, LocalDate to) {
        Map<LocalDate, EquityPrice> existingByDate = new HashMap<>();

        equityPriceRepository.findAllByAssetIdAndDataDateBetweenOrderByDataDateAsc(asset.getId(), from, to)
                .forEach(price -> existingByDate.put(price.getDataDate(), price));

        return existingByDate;
    }
}
