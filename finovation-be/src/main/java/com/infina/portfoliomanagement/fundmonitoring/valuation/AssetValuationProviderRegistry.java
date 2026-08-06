package com.infina.portfoliomanagement.fundmonitoring.valuation;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class AssetValuationProviderRegistry {

    private final Map<AssetType, AssetValuationProvider> providersByType;

    public AssetValuationProviderRegistry(List<AssetValuationProvider> providers) {
        EnumMap<AssetType, AssetValuationProvider> indexedProviders =
                new EnumMap<>(AssetType.class);
        for (AssetValuationProvider provider : providers) {
            AssetValuationProvider previous = indexedProviders.put(
                    provider.supportedType(),
                    provider
            );
            if (previous != null) {
                throw new IllegalStateException(
                        "Multiple valuation providers registered for "
                                + provider.supportedType()
                );
            }
        }
        providersByType = Map.copyOf(indexedProviders);
    }

    public Map<Long, NavigableMap<LocalDate, BigDecimal>> loadUnitValues(
            List<Asset> assets,
            LocalDate from,
            LocalDate to
    ) {

        Map<AssetType, List<Long>> assetIdsByType = assets.stream()
                .collect(Collectors.groupingBy(
                        Asset::getAssetType,
                        () -> new EnumMap<>(AssetType.class),
                        Collectors.mapping(Asset::getId, Collectors.toList())
                ));

        Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValues = new HashMap<>();

        for (Map.Entry<AssetType, List<Long>> entry : assetIdsByType.entrySet()) {
            AssetValuationProvider provider = providersByType.get(entry.getKey());
            if (provider == null) {
                throw unavailable();
            }

            Map<Long, NavigableMap<LocalDate, BigDecimal>> providedValues =
                    provider.loadUnitValues(entry.getValue(), from, to);
            for (Long assetId : entry.getValue()) {
                NavigableMap<LocalDate, BigDecimal> values = providedValues.get(assetId);
                if (values == null || values.isEmpty()) {
                    throw unavailable();
                }
                unitValues.put(assetId, values);
            }
        }

        return unitValues;
    }

    private BaseException unavailable() {
        return new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
    }
}
