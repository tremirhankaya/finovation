package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.dto.analysis.FundPositionResponse;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FundPositionRepository extends JpaRepository<FundPosition, Long> {

    List<FundPosition> findAllByFundPortfolioIdOrderByWeightDesc(Long fundPortfolioId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from FundPosition p where p.fundPortfolio.id = :portfolioId")
    void deleteAllByFundPortfolioId(@Param("portfolioId") Long portfolioId);

    @Query("""
            SELECT new com.infina.portfoliomanagement.fund.dto.analysis.FundPositionResponse(
                fp.asset.assetCode,
                fp.asset.displayName,
                fp.weight,
                fp.aiNote,
                s.name,
                fp.asset.assetType
            )
            FROM FundPosition fp
            LEFT JOIN fp.asset.equityDetail ed
            LEFT JOIN ed.sector s
            WHERE fp.fundPortfolio.id = :portfolioId
            ORDER BY fp.weight DESC
            """)
    List<FundPositionResponse> findPositionResponsesByPortfolioId(@Param("portfolioId") Long portfolioId);
}

