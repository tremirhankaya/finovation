package com.infina.portfoliomanagement.stresstest.repository;

import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fund.enums.FundDesignMode;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import com.infina.portfoliomanagement.stresstest.repository.projection.StressPortfolioPositionProjection;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface StressPortfolioQueryRepository
        extends Repository<FundPosition, Long> {

    @Query("""
        select
            portfolio.id as portfolioId,
            position.assetId as assetId,
            asset.assetCode as assetCode,
            asset.assetType as assetType,
            position.weight as weight
        from FundPosition position
        join position.fundPortfolio portfolio
        join portfolio.fundDraft draft
        join Asset asset on asset.id = position.assetId
        where draft.publicId = :fundPublicId
          and draft.createdByUserId = :userId
          and (
                portfolio.selected = true
                or (
                    draft.designMode = :manualDesignMode
                    and portfolio.portfolioType = :workingPortfolioType
                )
          )
          and asset.active = true
        order by position.weight desc
        """)
    List<StressPortfolioPositionProjection> findSelectedOrManualWorkingPortfolioPositions(
            @Param("fundPublicId") UUID fundPublicId,
            @Param("userId") Long userId,
            @Param("manualDesignMode") FundDesignMode manualDesignMode,
            @Param("workingPortfolioType") PortfolioType workingPortfolioType
    );
}
