package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.repository.projection.ArchivedFundDraftProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FundDraftRepository
        extends JpaRepository<FundDraft, Long>, JpaSpecificationExecutor<FundDraft> {

    Optional<FundDraft> findByPublicId(UUID publicId);

    List<FundDraft> findAllByCreatedByUserIdOrderByCreatedAtDesc(Long createdByUserId);

    List<FundDraft> findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
            FundDraftStatus status,
            Long createdByUserId
    );

    Optional<FundDraft> findByPublicIdAndStatus(
            UUID publicId,
            FundDraftStatus status
    );

    List<FundDraft> findAllByPublicIdIn(List<UUID> publicIds);

    @Query(value = """
            SELECT CAST(public_id AS CHAR(36)) AS publicId,
                   name                        AS name,
                   status                      AS status,
                   updated_at                  AS archivedAt
            FROM dbo.fund_drafts
            WHERE is_deleted = 1
              AND created_by_user_id = :ownerId
            ORDER BY updated_at DESC
            """, nativeQuery = true)
    List<ArchivedFundDraftProjection> findArchivedByOwnerId(@Param("ownerId") Long ownerId);
}
