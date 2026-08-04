package com.infina.portfoliomanagement.marketdata.service.equity.price;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityPrice;
import com.infina.portfoliomanagement.marketdata.entity.EquityPriceRevision;
import com.infina.portfoliomanagement.marketdata.infina.dto.EquityPriceRecord;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Component
class EquityPriceChangeCollector {

    public PriceChanges collect(Asset asset,
                                List<EquityPriceRecord> records,
                                Map<LocalDate, EquityPrice> existingByDate,
                                LocalDateTime now) {
        List<EquityPrice> newPrices = new ArrayList<>();
        List<EquityPrice> updatedPrices = new ArrayList<>();
        List<EquityPriceRevision> revisions = new ArrayList<>();

        for (EquityPriceRecord record : records) {
            if (isIncomplete(record)) {
                log.warn("{}: skipping incomplete price record for {}", asset.getAssetCode(), record.dataDate());
                continue;
            }

            EquityPrice existing = existingByDate.get(record.dataDate());

            if (existing == null) {
                newPrices.add(toNewPrice(asset, record, now));
                continue;
            }

            if (!hasChanged(existing, record)) {
                continue;
            }

            log.info("{} {}: price revised, close {} -> {}, source record {} -> {}",
                    asset.getAssetCode(), record.dataDate(),
                    existing.getClosePrice(), record.closePrice(),
                    existing.getSourceRecordDate(), record.recordDate());

            revisions.add(toRevision(asset, existing, record, now));
            applyTo(existing, record, now);
            updatedPrices.add(existing);
        }

        return new PriceChanges(newPrices, updatedPrices, revisions);
    }

    private boolean isIncomplete(EquityPriceRecord record) {
        return record.dataDate() == null || record.closePrice() == null;
    }

    private EquityPrice toNewPrice(Asset asset, EquityPriceRecord record, LocalDateTime now) {
        return EquityPrice.builder()
                .asset(asset)
                .dataDate(record.dataDate())
                .openPrice(record.openPrice())
                .highPrice(record.highPrice())
                .lowPrice(record.lowPrice())
                .closePrice(record.closePrice())
                .sourceRecordDate(record.recordDate())
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private EquityPriceRevision toRevision(Asset asset,
                                           EquityPrice existing,
                                           EquityPriceRecord record,
                                           LocalDateTime now) {
        return EquityPriceRevision.builder()
                .asset(asset)
                .dataDate(record.dataDate())
                .oldClosePrice(existing.getClosePrice())
                .newClosePrice(record.closePrice())
                .oldSourceRecordDate(existing.getSourceRecordDate())
                .newSourceRecordDate(record.recordDate())
                .detectedAt(now)
                .build();
    }

    private void applyTo(EquityPrice existing, EquityPriceRecord record, LocalDateTime now) {
        existing.setOpenPrice(record.openPrice());
        existing.setHighPrice(record.highPrice());
        existing.setLowPrice(record.lowPrice());
        existing.setClosePrice(record.closePrice());
        existing.setSourceRecordDate(record.recordDate());
        existing.setUpdatedAt(now);
    }

    private boolean hasChanged(EquityPrice existing, EquityPriceRecord record) {
        return differs(existing.getOpenPrice(), record.openPrice())
                || differs(existing.getHighPrice(), record.highPrice())
                || differs(existing.getLowPrice(), record.lowPrice())
                || differs(existing.getClosePrice(), record.closePrice())
                || !Objects.equals(existing.getSourceRecordDate(), record.recordDate());
    }

    private boolean differs(BigDecimal current, BigDecimal incoming) {
        if (current == null && incoming == null) {
            return false;
        }
        if (current == null || incoming == null) {
            return true;
        }
        return current.compareTo(incoming) != 0;
    }
}
