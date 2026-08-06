package com.infina.portfoliomanagement.marketdata.repository;

import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EquityDetailRepository extends JpaRepository<EquityDetail, Long> {

    List<EquityDetail> findAllBySectorId(Long sectorId);

    @EntityGraph(attributePaths = {"asset", "sector"})
    List<EquityDetail> findAllByAssetIdIn(List<Long> assetIds);
}
