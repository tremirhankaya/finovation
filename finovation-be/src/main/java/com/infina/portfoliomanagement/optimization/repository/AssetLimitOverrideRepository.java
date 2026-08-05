package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.AssetLimitOverride;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssetLimitOverrideRepository extends JpaRepository<AssetLimitOverride, Long> {

    List<AssetLimitOverride> findAllByRequestId(Long requestId);
}
