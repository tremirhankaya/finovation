package com.infina.portfoliomanagement.stresstest.rl.repository;

import com.infina.portfoliomanagement.stresstest.rl.entity.RlStressTest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RlStressTestRepository
        extends JpaRepository<RlStressTest, Long> {

    Optional<RlStressTest> findByPublicIdAndUserId(
            UUID publicId,
            Long userId
    );

    List<RlStressTest> findAllByUserIdOrderByCreatedAtDesc(
            Long userId
    );
}