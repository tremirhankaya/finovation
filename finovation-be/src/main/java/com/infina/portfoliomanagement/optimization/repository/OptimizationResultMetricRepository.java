package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.OptimizationResultMetric;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OptimizationResultMetricRepository extends JpaRepository<OptimizationResultMetric, Long> {

    List<OptimizationResultMetric> findAllByResultId(Long resultId);
}
