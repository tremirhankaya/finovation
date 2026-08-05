package com.infina.portfoliomanagement.optimization.repository;

import com.infina.portfoliomanagement.optimization.entity.RequestConstraintTarget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RequestConstraintTargetRepository extends JpaRepository<RequestConstraintTarget, Long> {

    List<RequestConstraintTarget> findAllByRequestId(Long requestId);
}
