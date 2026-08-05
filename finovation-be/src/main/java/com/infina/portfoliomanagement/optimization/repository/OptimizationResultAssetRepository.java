package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.OptimizationResultAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OptimizationResultAssetRepository extends JpaRepository<OptimizationResultAsset, Long> {

    List<OptimizationResultAsset> findAllByResultId(Long resultId);
}
