package com.infina.portfoliomanagement.marketdata.service.equity.definition;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.entity.Sector;
import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.marketdata.infina.api.CodeDefinitionApi;
import com.infina.portfoliomanagement.marketdata.infina.dto.CodeDefinitionRecord;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.marketdata.repository.SectorRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
public class EquityDefinitionSyncService {

    private final CodeDefinitionApi codeDefinitionApi;
    private final AssetRepository assetRepository;
    private final EquityDetailRepository equityDetailRepository;
    private final SectorRepository sectorRepository;
    private final Clock clock;

    public EquityDefinitionSyncService(CodeDefinitionApi codeDefinitionApi,
                                        AssetRepository assetRepository,
                                        EquityDetailRepository equityDetailRepository,
                                        SectorRepository sectorRepository,
                                        Clock clock) {
        this.codeDefinitionApi = codeDefinitionApi;
        this.assetRepository = assetRepository;
        this.equityDetailRepository = equityDetailRepository;
        this.sectorRepository = sectorRepository;
        this.clock = clock;
    }

    public void sync() {
        List<Asset> equities = assetRepository.findAllByAssetTypeAndActiveTrueOrderByAssetCodeAsc(AssetType.EQUITY);
        Map<String, Sector> sectorsByCode = sectorRepository.findAll().stream()
                .collect(Collectors.toMap(Sector::getSectorCode, Function.identity()));

        log.info("equity definition sync started: {} asset(s)", equities.size());

        int updated = 0;
        int notFound = 0;
        int failed = 0;

        for (Asset asset : equities) {
            try {
                if (syncAsset(asset, sectorsByCode)) {
                    updated++;
                } else {
                    notFound++;
                }
            } catch (Exception e) {
                log.error("{}: definition sync failed", asset.getAssetCode(), e);
                failed++;
            }
        }

        log.info("equity definition sync finished: {} updated, {} not found, {} failed", updated, notFound, failed);
    }

    private boolean syncAsset(Asset asset, Map<String, Sector> sectorsByCode) {
        String queryCode = asset.getQueryCode();

        if (queryCode == null || queryCode.isBlank()) {
            log.warn("{}: query code is not defined, definition cannot be fetched", asset.getAssetCode());
            return false;
        }

        CodeDefinitionRecord record = codeDefinitionApi.fetchEquities(queryCode).stream()
                .filter(candidate -> asset.getAssetCode().equals(candidate.assetCode()))
                .findFirst()
                .orElse(null);

        if (record == null) {
            log.warn("{}: no matching definition returned for code '{}'", asset.getAssetCode(), queryCode);
            return false;
        }

        LocalDateTime now = LocalDateTime.now(clock);

        asset.setDisplayName(record.securityDesc());
        asset.setUpdatedAt(now);
        assetRepository.save(asset);

        EquityDetail detail = equityDetailRepository.findById(asset.getId())
                .orElseGet(() -> EquityDetail.builder()
                        .asset(asset)
                        .createdAt(now)
                        .build());

        detail.setSector(resolveSector(asset.getAssetCode(), record.sector(), sectorsByCode));
        detail.setCompanyName(record.issueName());
        detail.setSecurityType(record.securityType());
        detail.setVendorCode(record.vendor());
        detail.setIssuerCode(record.issuer());
        detail.setIsinCode(record.isinCode());
        detail.setLegacyCode(record.legacyCode());
        detail.setMarketCode(record.marketCode());
        detail.setUpdatedAt(now);

        equityDetailRepository.save(detail);
        return true;
    }

    private Sector resolveSector(String assetCode, String sectorCode, Map<String, Sector> sectorsByCode) {
        if (sectorCode == null || sectorCode.isBlank()) {
            log.warn("{}: no sector code returned, asset will stay out of the model universe", assetCode);
            return null;
        }

        Sector sector = sectorsByCode.get(sectorCode);
        if (sector == null) {
            log.warn("{}: sector '{}' is not present in the sector table", assetCode, sectorCode);
        }
        return sector;
    }
}
