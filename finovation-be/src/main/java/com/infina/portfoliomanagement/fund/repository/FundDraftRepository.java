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

    @Query(value = "SELECT * FROM dbo.fund_drafts WHERE public_id = :publicId", nativeQuery = true)
    Optional<FundDraft> findDeletedOrActiveByPublicId(@Param("publicId") UUID publicId);

    List<FundDraft> findAllByCreatedByUserIdOrderByCreatedAtDesc(Long createdByUserId);

    List<FundDraft> findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
            FundDraftStatus status,
            Long createdByUserId
    );

    long countByStatusAndCreatedByUserId(
            FundDraftStatus status,
            Long createdByUserId
    );

    List<FundDraft> findTop3ByStatusAndCreatedByUserIdOrderByUpdatedAtDescIdDesc(
            FundDraftStatus status,
            Long createdByUserId
    );

    Optional<FundDraft> findByPublicIdAndStatus(
            UUID publicId,
            FundDraftStatus status
    );

    List<FundDraft> findAllByPublicIdIn(List<UUID> publicIds);

    @Query(value = """
            SELECT CAST(f.public_id AS CHAR(36)) AS publicId,
                   f.name                        AS name,
                   f.status                      AS status,
                   f.updated_at                  AS archivedAt,
                   f.initial_portfolio_size      AS initialPortfolioSize,
                   f.unit_price                  AS unitPrice,
                   u.email                       AS deletedBy
            FROM dbo.fund_drafts f
            LEFT JOIN dbo.users u ON f.deleted_by_user_id = u.id
            WHERE f.is_deleted = 1
              AND f.created_by_user_id = :ownerId
            ORDER BY f.updated_at DESC
            """, nativeQuery = true)
    List<ArchivedFundDraftProjection> findArchivedByOwnerId(@Param("ownerId") Long ownerId);
}
