package com.infina.portfoliomanagement.fundmonitoring.repository;

import com.infina.portfoliomanagement.fundmonitoring.entity.FundRebalance;
import com.infina.portfoliomanagement.fundmonitoring.enums.FundRebalanceType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface FundRebalanceRepository extends JpaRepository<FundRebalance, Long> {

    boolean existsByFundDraft_IdAndRebalanceType(
            Long fundDraftId,
            FundRebalanceType rebalanceType
    );

    boolean existsByOptimizationRequestId(Long optimizationRequestId);

    @EntityGraph(attributePaths = {"positions", "positions.asset"})
    List<FundRebalance> findAllByFundDraft_IdAndEffectiveAtLessThanEqualOrderByEffectiveAtAscIdAsc(
            Long fundDraftId,
            LocalDateTime effectiveAt
    );
}
