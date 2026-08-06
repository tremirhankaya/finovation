package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.OptimizationRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OptimizationRequestRepository extends JpaRepository<OptimizationRequest, Long> {

    List<OptimizationRequest> findAllByFundId(Long fundId);

    List<OptimizationRequest> findAllByFundIdAndRequestedById(Long fundId, Long requestedById);
}
