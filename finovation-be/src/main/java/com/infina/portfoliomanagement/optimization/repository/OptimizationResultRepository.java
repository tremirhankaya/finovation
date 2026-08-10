package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.OptimizationResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OptimizationResultRepository extends JpaRepository<OptimizationResult, Long> {

    List<OptimizationResult> findAllByRequestId(Long requestId);

    Optional<OptimizationResult> findFirstByRequestIdOrderByIdDesc(Long requestId);
}
