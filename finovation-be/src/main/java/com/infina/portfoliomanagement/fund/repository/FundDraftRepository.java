package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.entity.FundDraft;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FundDraftRepository extends JpaRepository<FundDraft, Long> {

    Optional<FundDraft> findByPublicId(UUID publicId);

    List<FundDraft> findAllByCreatedByUserIdOrderByCreatedAtDesc(Long createdByUserId);
}
