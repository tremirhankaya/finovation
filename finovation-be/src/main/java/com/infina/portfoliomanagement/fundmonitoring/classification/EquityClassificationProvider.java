package com.infina.portfoliomanagement.fundmonitoring.classification;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.fundmonitoring.model.AssetMonitoringProfile;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class EquityClassificationProvider implements AssetClassificationProvider {

    private static final String UNCLASSIFIED_ID = "unclassified";
    private static final String UNCLASSIFIED_NAME = "Sınıflandırılmamış";

    private final EquityDetailRepository equityDetailRepository;

    @Override
    public AssetType supportedType() {
        return AssetType.EQUITY;
    }

    @Override
    public Map<Long, AssetMonitoringProfile> loadProfiles(List<Asset> assets) {
        List<Long> assetIds = assets.stream().map(Asset::getId).toList();
        Map<Long, EquityDetail> detailsByAssetId = equityDetailRepository
                .findAllByAssetIdIn(assetIds).stream()
                .collect(Collectors.toMap(EquityDetail::getAssetId, Function.identity()));

        return assets.stream().collect(Collectors.toMap(
                Asset::getId,
                asset -> profile(asset, detailsByAssetId.get(asset.getId()))
        ));
    }

    private AssetMonitoringProfile profile(Asset asset, EquityDetail detail) {
        boolean hasSector = detail != null && detail.getSector() != null;

        return new AssetMonitoringProfile(
                asset.getId(),
                asset.getQueryCode() == null ? asset.getAssetCode() : asset.getQueryCode(),
                detail == null ? asset.getDisplayName() : detail.getCompanyName(),
                hasSector ? detail.getSector().getId().toString() : UNCLASSIFIED_ID,
                hasSector ? detail.getSector().getName() : UNCLASSIFIED_NAME,
                false
        );
    }
}
