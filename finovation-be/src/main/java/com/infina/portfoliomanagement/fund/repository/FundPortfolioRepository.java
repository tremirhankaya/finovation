package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FundPortfolioRepository extends JpaRepository<FundPortfolio, Long> {

    Optional<FundPortfolio> findByFundDraftIdAndSelectedTrue(Long fundDraftId);

    Optional<FundPortfolio> findByFundDraft_IdAndPortfolioType(
            Long fundDraftId,
            PortfolioType portfolioType
    );

    List<FundPortfolio> findAllByModelRunIdAndPortfolioTypeOrderByProposalRankAsc(
            Long modelRunId,
            PortfolioType portfolioType
    );

    Optional<FundPortfolio> findByModelRunIdAndProposalRank(Long modelRunId, Short proposalRank);

    List<FundPortfolio> findAllByFundDraft_IdAndSelectedTrue(Long fundDraftId);
}
