package com.infina.portfoliomanagement.fundmonitoring.classification;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.fundmonitoring.model.AssetMonitoringProfile;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class TppClassificationProvider implements AssetClassificationProvider {

    private static final String ALLOCATION_GROUP_ID = "asset-type-tpp";
    private static final String ALLOCATION_GROUP_NAME = "Nakit ve Para Piyasası";

    @Override
    public AssetType supportedType() {
        return AssetType.TPP;
    }

    @Override
    public Map<Long, AssetMonitoringProfile> loadProfiles(List<Asset> assets) {
        return assets.stream().collect(Collectors.toMap(
                Asset::getId,
                asset -> new AssetMonitoringProfile(
                        asset.getId(),
                        asset.getAssetCode(),
                        asset.getDisplayName(),
                        ALLOCATION_GROUP_ID,
                        ALLOCATION_GROUP_NAME,
                        true
                )
        ));
    }
}
