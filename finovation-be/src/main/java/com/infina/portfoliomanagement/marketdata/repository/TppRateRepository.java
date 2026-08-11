package com.infina.portfoliomanagement.marketdata.repository;

import com.infina.portfoliomanagement.marketdata.entity.TppRate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TppRateRepository extends JpaRepository<TppRate, Long> {

    List<TppRate> findAllByAssetIdAndDataDateBetweenOrderByDataDateAsc(
            Long assetId, LocalDate from, LocalDate to);

    Optional<TppRate> findTopByAssetIdOrderByDataDateDesc(Long assetId);

    Optional<TppRate> findTopByAssetIdAndDataDateLessThanEqualOrderByDataDateDesc(
            Long assetId,
            LocalDate dataDate
    );

    @EntityGraph(attributePaths = "asset")
    List<TppRate> findAllByAssetIdInAndDataDateBetweenOrderByDataDateAsc(
            List<Long> assetIds,
            LocalDate from,
            LocalDate to
    );

    @EntityGraph(attributePaths = "asset")
    List<TppRate> findAllByAssetIdInAndDataDateLessThanEqualOrderByDataDateAsc(
            List<Long> assetIds,
            LocalDate to
    );
}
