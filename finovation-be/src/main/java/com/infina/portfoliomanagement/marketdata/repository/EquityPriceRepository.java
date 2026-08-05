package com.infina.portfoliomanagement.marketdata.repository;

import com.infina.portfoliomanagement.marketdata.entity.EquityPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface EquityPriceRepository extends JpaRepository<EquityPrice, Long> {

    List<EquityPrice> findAllByAssetIdAndDataDateBetweenOrderByDataDateAsc(
            Long assetId, LocalDate from, LocalDate to);

    Optional<EquityPrice> findTopByAssetIdOrderByDataDateDesc(Long assetId);

    boolean existsByAssetIdAndDataDate(Long assetId, LocalDate dataDate);
}
