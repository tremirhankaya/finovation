package com.infina.portfoliomanagement.fundmonitoring.classification;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fundmonitoring.model.AssetMonitoringProfile;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class AssetClassificationProviderRegistry {

    private final Map<AssetType, AssetClassificationProvider> providersByType;

    public AssetClassificationProviderRegistry(
            List<AssetClassificationProvider> providers
    ) {
        EnumMap<AssetType, AssetClassificationProvider> indexedProviders =
                new EnumMap<>(AssetType.class);
        for (AssetClassificationProvider provider : providers) {
            AssetClassificationProvider previous = indexedProviders.put(
                    provider.supportedType(),
                    provider
            );
            if (previous != null) {
                throw new IllegalStateException(
                        "Multiple classification providers registered for "
                                + provider.supportedType()
                );
            }
        }
        providersByType = Map.copyOf(indexedProviders);
    }

    public Map<Long, AssetMonitoringProfile> loadProfiles(List<Asset> assets) {
        Map<AssetType, List<Asset>> assetsByType = assets.stream()
                .collect(Collectors.groupingBy(
                        Asset::getAssetType,
                        () -> new EnumMap<>(AssetType.class),
                        Collectors.toList()
                ));

        Map<Long, AssetMonitoringProfile> profiles = new HashMap<>();

        for (Map.Entry<AssetType, List<Asset>> entry : assetsByType.entrySet()) {
            AssetClassificationProvider provider = providersByType.get(entry.getKey());
            if (provider == null) {
                throw unavailable();
            }
            Map<Long, AssetMonitoringProfile> providedProfiles =
                    provider.loadProfiles(entry.getValue());
            for (Asset asset : entry.getValue()) {
                AssetMonitoringProfile profile = providedProfiles.get(asset.getId());
                if (profile == null) {
                    throw unavailable();
                }
                profiles.put(asset.getId(), profile);
            }
        }

        return profiles;
    }

    private BaseException unavailable() {
        return new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
    }
}
