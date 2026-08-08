package com.infina.portfoliomanagement.optimization.service;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.entity.Sector;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.optimization.dto.InvestmentUniverseAssetResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvestmentUniverseServiceTest {

    @Mock
    private AssetRepository assetRepository;

    @Mock
    private EquityDetailRepository equityDetailRepository;

    @Test
    void returnsAssetsWithSectorNameFromEquityDetail() {
        InvestmentUniverseService service =
                new InvestmentUniverseService(assetRepository, equityDetailRepository);

        Asset asset = buildAsset(1L, "MGROS", null);
        Sector sector = buildSector("Perakende Ticaret");
        EquityDetail detail = buildEquityDetail(asset, sector, "Migros Ticaret A.Ş.");

        when(assetRepository.findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                AssetType.EQUITY
        )).thenReturn(List.of(asset));
        when(equityDetailRepository.findAllByAssetIdIn(List.of(1L))).thenReturn(List.of(detail));

        List<InvestmentUniverseAssetResponse> result = service.listInvestmentUniverse();

        assertThat(result).containsExactly(
                new InvestmentUniverseAssetResponse("MGROS", "Migros Ticaret A.Ş.", "Perakende Ticaret")
        );
    }

    @Test
    void prefersAssetDisplayNameOverCompanyName() {
        InvestmentUniverseService service =
                new InvestmentUniverseService(assetRepository, equityDetailRepository);

        Asset asset = buildAsset(1L, "MGROS", "Migros");
        EquityDetail detail = buildEquityDetail(asset, null, "Migros Ticaret A.Ş.");

        when(assetRepository.findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                AssetType.EQUITY
        )).thenReturn(List.of(asset));
        when(equityDetailRepository.findAllByAssetIdIn(List.of(1L))).thenReturn(List.of(detail));

        List<InvestmentUniverseAssetResponse> result = service.listInvestmentUniverse();

        assertThat(result).containsExactly(
                new InvestmentUniverseAssetResponse("MGROS", "Migros", null)
        );
    }

    @Test
    void fallsBackToAssetCodeWhenNoNameIsAvailable() {
        InvestmentUniverseService service =
                new InvestmentUniverseService(assetRepository, equityDetailRepository);

        Asset asset = buildAsset(1L, "MGROS", null);

        when(assetRepository.findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                AssetType.EQUITY
        )).thenReturn(List.of(asset));
        when(equityDetailRepository.findAllByAssetIdIn(List.of(1L))).thenReturn(List.of());

        List<InvestmentUniverseAssetResponse> result = service.listInvestmentUniverse();

        assertThat(result).containsExactly(
                new InvestmentUniverseAssetResponse("MGROS", "MGROS", null)
        );
    }

    @Test
    void returnsEmptyListWithoutQueryingEquityDetailsWhenUniverseIsEmpty() {
        InvestmentUniverseService service =
                new InvestmentUniverseService(assetRepository, equityDetailRepository);

        when(assetRepository.findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                AssetType.EQUITY
        )).thenReturn(List.of());

        List<InvestmentUniverseAssetResponse> result = service.listInvestmentUniverse();

        assertThat(result).isEmpty();
        verifyNoInteractions(equityDetailRepository);
    }

    private static Asset buildAsset(Long id, String assetCode, String displayName) {
        return Asset.builder()
                .id(id)
                .assetCode(assetCode)
                .assetType(AssetType.EQUITY)
                .displayName(displayName)
                .currencyCode("TRY")
                .active(true)
                .inModelUniverse(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private static Sector buildSector(String name) {
        return Sector.builder()
                .id(1L)
                .sectorCode("S001")
                .name(name)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private static EquityDetail buildEquityDetail(Asset asset, Sector sector, String companyName) {
        return EquityDetail.builder()
                .assetId(asset.getId())
                .asset(asset)
                .sector(sector)
                .companyName(companyName)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
