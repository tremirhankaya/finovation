package com.infina.portfoliomanagement.marketdata.service.tpp;

import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.TppRate;
import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.marketdata.infina.api.TppRateApi;
import com.infina.portfoliomanagement.marketdata.infina.dto.TppRateRecord;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.TppRateRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
public class TppRateSyncService {

    private final TppRateApi tppRateApi;
    private final AssetRepository assetRepository;
    private final TppRateRepository tppRateRepository;
    private final Clock clock;
    private final FinancialTimeProvider financialTime;
    private final LocalDate historyStart;

    public TppRateSyncService(TppRateApi tppRateApi,
                              AssetRepository assetRepository,
                              TppRateRepository tppRateRepository,
                              Clock clock,
                              FinancialTimeProvider financialTime,
                              @Value("${marketdata.sync.history-start:1990-01-01}") String historyStart) {
        this.tppRateApi = tppRateApi;
        this.assetRepository = assetRepository;
        this.tppRateRepository = tppRateRepository;
        this.clock = clock;
        this.financialTime = financialTime;
        this.historyStart = LocalDate.parse(historyStart);
    }

    public void sync() {
        List<Asset> tppAssets = assetRepository.findAllByAssetTypeAndActiveTrueOrderByAssetCodeAsc(AssetType.TPP);
        LocalDate today = financialTime.currentDate();

        log.info("tpp rate sync started: {} asset(s)", tppAssets.size());

        int inserted = 0;
        int failed = 0;

        for (Asset asset : tppAssets) {
            try {
                inserted += syncAsset(asset, today);
            } catch (Exception e) {
                log.error("{}: tpp rate sync failed", asset.getAssetCode(), e);
                failed++;
            }
        }

        log.info("tpp rate sync finished: {} inserted, {} failed", inserted, failed);
    }

    private int syncAsset(Asset asset, LocalDate today) {
        String maturityDays = asset.getQueryCode();

        if (maturityDays == null || maturityDays.isBlank()) {
            log.warn("{}: query code is not defined, rates cannot be fetched", asset.getAssetCode());
            return 0;
        }

        LocalDate from = resolveStartDate(asset);

        if (from.isAfter(today)) {
            return 0;
        }

        List<TppRateRecord> records = tppRateApi.fetchRange(maturityDays, from, today);

        if (records.isEmpty()) {
            log.warn("{}: no rate data returned for {} - {}", asset.getAssetCode(), from, today);
            return 0;
        }

        Set<LocalDate> existingDates = loadExistingDates(asset, from, today);
        LocalDateTime now = LocalDateTime.now(clock);
        List<TppRate> newRates = new ArrayList<>();

        for (TppRateRecord record : records) {
            if (isIncomplete(record)) {
                log.warn("{}: skipping incomplete rate record for {}", asset.getAssetCode(), record.dataDate());
                continue;
            }

            if (existingDates.contains(record.dataDate())) {
                continue;
            }

            newRates.add(toRate(asset, record, now));
        }

        if (!newRates.isEmpty()) {
            tppRateRepository.saveAll(newRates);
        }

        return newRates.size();
    }

    private LocalDate resolveStartDate(Asset asset) {
        Optional<TppRate> latest = tppRateRepository.findTopByAssetIdOrderByDataDateDesc(asset.getId());

        if (latest.isEmpty()) {
            return historyStart;
        }

        return latest.get().getDataDate().plusDays(1);
    }

    private Set<LocalDate> loadExistingDates(Asset asset, LocalDate from, LocalDate to) {
        Set<LocalDate> dates = new HashSet<>();

        tppRateRepository.findAllByAssetIdAndDataDateBetweenOrderByDataDateAsc(asset.getId(), from, to)
                .forEach(rate -> dates.add(rate.getDataDate()));

        return dates;
    }

    private boolean isIncomplete(TppRateRecord record) {
        return record.dataDate() == null || record.weightedAverageRate() == null;
    }

    private TppRate toRate(Asset asset, TppRateRecord record, LocalDateTime now) {
        return TppRate.builder()
                .asset(asset)
                .dataDate(record.dataDate())
                .maturityDate(record.maturityDate())
                .openRate(record.openRate())
                .highRate(record.highRate())
                .lowRate(record.lowRate())
                .closeRate(record.closeRate())
                .weightedAverageRate(record.weightedAverageRate())
                .tradingVolume(record.tradingVolume())
                .transactionCount(record.transactionCount())
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
