package com.infina.portfoliomanagement.marketdata.repository;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.common.enums.AssetType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssetRepository extends JpaRepository<Asset, Long> {

    Optional<Asset> findByAssetCode(String assetCode);

    List<Asset> findAllByAssetCodeIn(List<String> assetCodes);

    List<Asset> findAllByQueryCodeIn(List<String> queryCodes);

    List<Asset> findAllByAssetTypeAndActiveTrueOrderByAssetCodeAsc(AssetType assetType);

    List<Asset> findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
            AssetType assetType
    );

    List<Asset> findAllByInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc();
}
