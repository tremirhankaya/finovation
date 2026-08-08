package com.infina.portfoliomanagement.optimization.service;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.optimization.dto.InvestmentUniverseAssetResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvestmentUniverseService {

    private final AssetRepository assetRepository;
    private final EquityDetailRepository equityDetailRepository;

    @Transactional(readOnly = true)
    public List<InvestmentUniverseAssetResponse> listInvestmentUniverse() {
        List<Asset> assets = assetRepository
                .findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                        AssetType.EQUITY
                );
        if (assets.isEmpty()) {
            return List.of();
        }

        Map<Long, EquityDetail> detailByAssetId = equityDetailRepository
                .findAllByAssetIdIn(assets.stream().map(Asset::getId).toList())
                .stream()
                .collect(Collectors.toMap(
                        EquityDetail::getAssetId,
                        detail -> detail,
                        (left, right) -> left
                ));

        return assets.stream()
                .map(asset -> {
                    EquityDetail detail = detailByAssetId.get(asset.getId());
                    return new InvestmentUniverseAssetResponse(
                            asset.getAssetCode(),
                            resolveName(asset, detail),
                            resolveSectorName(detail)
                    );
                })
                .toList();
    }

    private static String resolveName(Asset asset, EquityDetail detail) {
        if (asset.getDisplayName() != null && !asset.getDisplayName().isBlank()) {
            return asset.getDisplayName();
        }
        if (detail != null && detail.getCompanyName() != null && !detail.getCompanyName().isBlank()) {
            return detail.getCompanyName();
        }
        return asset.getAssetCode();
    }

    private static String resolveSectorName(EquityDetail detail) {
        if (detail == null || detail.getSector() == null) {
            return null;
        }
        return detail.getSector().getName();
    }
}
