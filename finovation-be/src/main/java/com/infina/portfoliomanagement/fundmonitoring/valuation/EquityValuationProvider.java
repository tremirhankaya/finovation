package com.infina.portfoliomanagement.fundmonitoring.valuation;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.marketdata.entity.EquityPrice;
import com.infina.portfoliomanagement.marketdata.repository.EquityPriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

@Component
@RequiredArgsConstructor
public class EquityValuationProvider implements AssetValuationProvider {

    private final EquityPriceRepository equityPriceRepository;

    @Override
    public AssetType supportedType() {
        return AssetType.EQUITY;
    }

    @Override
    public Map<Long, NavigableMap<LocalDate, BigDecimal>> loadUnitValues(
            List<Long> assetIds,
            LocalDate from,
            LocalDate to
    ) {
        List<EquityPrice> prices = equityPriceRepository
                .findAllByAssetIdInAndDataDateBetweenOrderByDataDateAsc(
                        assetIds,
                        from,
                        to
                );
        Map<Long, NavigableMap<LocalDate, BigDecimal>> valuesByAsset =
                new HashMap<>();

        for (EquityPrice price : prices) {
            valuesByAsset
                    .computeIfAbsent(price.getAsset().getId(), ignored -> new TreeMap<>())
                    .put(price.getDataDate(), price.getClosePrice());
        }

        return valuesByAsset;
    }
}
