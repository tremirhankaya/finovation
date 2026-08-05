package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.AssetPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AssetPreferenceRepository extends JpaRepository<AssetPreference, Long> {

    List<AssetPreference> findAllByRequestId(Long requestId);
}
