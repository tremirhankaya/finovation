package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.ConstraintCheck;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConstraintCheckRepository extends JpaRepository<ConstraintCheck, Long> {

    List<ConstraintCheck> findAllByRequestId(Long requestId);
}
