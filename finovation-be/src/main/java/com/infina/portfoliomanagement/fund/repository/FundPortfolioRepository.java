package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FundPortfolioRepository extends JpaRepository<FundPortfolio, Long> {

    Optional<FundPortfolio> findByFundDraftIdAndSelectedTrue(Long fundDraftId);
}
