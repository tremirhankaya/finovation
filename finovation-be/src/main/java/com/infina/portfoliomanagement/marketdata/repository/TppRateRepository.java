package com.infina.portfoliomanagement.marketdata.repository;

import com.infina.portfoliomanagement.marketdata.entity.TppRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TppRateRepository extends JpaRepository<TppRate, Long> {

    List<TppRate> findAllByAssetIdAndDataDateBetweenOrderByDataDateAsc(
            Long assetId, LocalDate from, LocalDate to);

    Optional<TppRate> findTopByAssetIdOrderByDataDateDesc(Long assetId);
}
