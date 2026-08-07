package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.TppRate;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.TppRateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;

@Component
@RequiredArgsConstructor
public class RiskFreeRateProvider {

    private static final String RISK_FREE_ASSET_CODE = "TPP1G";

    private final AssetRepository assetRepository;
    private final TppRateRepository tppRateRepository;

    public BigDecimal annualRate(LocalDate asOfDate) {
        return assetRepository.findByAssetCode(RISK_FREE_ASSET_CODE)
                .map(Asset::getId)
                .flatMap(assetId -> tppRateRepository
                        .findTopByAssetIdAndDataDateLessThanEqualOrderByDataDateDesc(
                                assetId,
                                asOfDate
                        ))
                .map(TppRate::getWeightedAverageRate)
                .orElse(null);
    }
}
