package com.infina.portfoliomanagement.stresstest.repository;

import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StressScenarioRepository extends JpaRepository<StressScenario, Long> {

    Optional<StressScenario> findByCodeAndActiveTrue(String code);

    List<StressScenario> findAllByActiveTrueOrderByDisplayOrderAsc();
}