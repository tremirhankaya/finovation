package com.infina.portfoliomanagement.stresstest.rl.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlPortfolioData;
import com.infina.portfoliomanagement.stresstest.service.StressPortfolioReader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class RlPortfolioService {

    private final StressPortfolioReader stressPortfolioReader;
    private final FundPortfolioRepository fundPortfolioRepository;

    public RlPortfolioService(
            StressPortfolioReader stressPortfolioReader,
            FundPortfolioRepository fundPortfolioRepository
    ) {
        this.stressPortfolioReader = stressPortfolioReader;
        this.fundPortfolioRepository = fundPortfolioRepository;
    }

    @Transactional(readOnly = true)
    public RlPortfolioData load(
            UUID fundPublicId,
            Long userId
    ) {
        StressPortfolioSnapshot snapshot =
                stressPortfolioReader.readSelectedPortfolio(
                        userId,
                        fundPublicId
                );

        FundPortfolio fundPortfolio = fundPortfolioRepository
                .findById(snapshot.portfolioId())
                .orElseThrow(() ->
                        new BaseException(
                                ErrorCode.STRESS_PORTFOLIO_NOT_AVAILABLE
                        )
                );

        return new RlPortfolioData(
                fundPortfolio,
                fundPortfolio.getFundDraft().getInitialPortfolioSize(),
                snapshot.positions()
        );
    }
}