package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.OptimizationRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OptimizationRequestRepository extends JpaRepository<OptimizationRequest, Long> {

    List<OptimizationRequest> findAllByFundId(UUID fundId);

    List<OptimizationRequest> findAllByFundIdAndRequestedById(UUID fundId, Long requestedById);

    Optional<OptimizationRequest> findFirstByFundIdAndCompletedAtIsNotNullOrderByCompletedAtDesc(UUID fundId);
}
