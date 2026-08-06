package com.infina.portfoliomanagement.fund.repository;

import com.infina.portfoliomanagement.fund.entity.FundPosition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FundPositionRepository extends JpaRepository<FundPosition, Long> {

    List<FundPosition> findAllByFundPortfolioIdOrderByWeightDesc(Long fundPortfolioId);
}
