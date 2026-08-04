package com.infina.portfoliomanagement.marketdata.repository;

import com.infina.portfoliomanagement.marketdata.entity.EquityPriceRevision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface EquityPriceRevisionRepository extends JpaRepository<EquityPriceRevision, Long> {

    List<EquityPriceRevision> findAllByAssetIdAndDataDateOrderByDetectedAtAsc(Long assetId, LocalDate dataDate);
}
