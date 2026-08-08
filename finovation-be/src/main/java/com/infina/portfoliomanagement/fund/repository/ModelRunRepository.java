package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.entity.ModelRun;
import com.infina.portfoliomanagement.fund.enums.ModelRunStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ModelRunRepository extends JpaRepository<ModelRun, Long> {

    Optional<ModelRun> findFirstByFundDraft_IdAndStatusAndRulesFingerprintOrderByIdDesc(
            Long fundDraftId,
            ModelRunStatus status,
            String rulesFingerprint
    );

    List<ModelRun> findAllByFundDraft_IdAndStatus(Long fundDraftId, ModelRunStatus status);
}
