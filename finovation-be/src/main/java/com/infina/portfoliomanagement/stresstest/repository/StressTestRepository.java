package com.infina.portfoliomanagement.stresstest.repository;

import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.enums.StressTestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StressTestRepository extends JpaRepository<StressTest, Long> {

    Optional<StressTest> findByPublicIdAndUserIdAndDeletedFalse(
            UUID publicId,
            Long userId
    );

    List<StressTest> findAllByUserIdAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            Long userId,
            StressTestStatus status
    );

    Optional<StressTest> findFirstByUserIdAndStatusAndDeletedFalseOrderByCreatedAtDescIdDesc(
            Long userId,
            StressTestStatus status
    );
}
