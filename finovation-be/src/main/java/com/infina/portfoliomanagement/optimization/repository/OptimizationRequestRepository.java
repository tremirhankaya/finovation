package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.OptimizationRequest;
import com.infina.portfoliomanagement.optimization.enums.RequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface OptimizationRequestRepository extends JpaRepository<OptimizationRequest, Long> {

    List<OptimizationRequest> findAllByFundId(UUID fundId);

    List<OptimizationRequest> findAllByFundIdAndRequestedById(UUID fundId, Long requestedById);

    Optional<OptimizationRequest> findFirstByFundIdAndCompletedAtIsNotNullOrderByCompletedAtDesc(UUID fundId);

    List<OptimizationRequest> findAllByRequestedByIdOrderByCreatedAtDesc(Long requestedById);

    List<OptimizationRequest> findAllByOrderByCreatedAtDesc();

    Optional<OptimizationRequest> findFirstByRequestedByIdOrderByCreatedAtDescIdDesc(
            Long requestedById
    );

    Optional<OptimizationRequest> findFirstByRequestedByIdAndStatusInOrderByCreatedAtDescIdDesc(
            Long requestedById,
            Set<RequestStatus> statuses
    );

    Optional<OptimizationRequest> findFirstByOrderByCreatedAtDescIdDesc();

    Optional<OptimizationRequest> findFirstByStatusInOrderByCreatedAtDescIdDesc(
            Set<RequestStatus> statuses
    );
}
