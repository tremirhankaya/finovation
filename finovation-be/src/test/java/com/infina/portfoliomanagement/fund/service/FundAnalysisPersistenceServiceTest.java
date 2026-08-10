package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.time.FinancialTimeProperties;
import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.fund.repository.FundPositionRepository;
import com.infina.portfoliomanagement.fund.repository.ModelRunRepository;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class FundAnalysisPersistenceServiceTest {

    @Mock
    private ModelRunRepository modelRunRepository;

    @Mock
    private FundPortfolioRepository fundPortfolioRepository;

    @Mock
    private FundPositionRepository fundPositionRepository;

    @Mock
    private FundDraftRepository fundDraftRepository;

    @Mock
    private AssetRepository assetRepository;

    private FundAnalysisPersistenceService service;

    @BeforeEach
    void setUp() {
        service = new FundAnalysisPersistenceService(
                modelRunRepository,
                fundPortfolioRepository,
                fundPositionRepository,
                fundDraftRepository,
                assetRepository,
                new FinancialTimeProvider(
                        Clock.systemUTC(),
                        new FinancialTimeProperties(false, null, null, ZoneOffset.UTC)
                )
        );
    }

    @Test
    void resolvePortfolioLabel_usesEntityLabelWhenPresent() {
        FundPortfolio portfolio = FundPortfolio.builder()
                .portfolioType(PortfolioType.PROPOSAL)
                .label("AI Proposal")
                .build();

        assertThat(service.resolvePortfolioLabel(portfolio)).isEqualTo("AI Proposal");
    }

    @Test
    void resolvePortfolioLabel_usesPortfolioTypeDefaultWhenLabelMissing() {
        FundPortfolio portfolio = FundPortfolio.builder()
                .portfolioType(PortfolioType.PROPOSAL)
                .build();

        assertThat(service.resolvePortfolioLabel(portfolio)).isEqualTo("Proposal");
    }

    @Test
    void resolvePortfolioLabel_usesWorkingDefaultWhenPortfolioMissing() {
        assertThat(service.resolvePortfolioLabel(null)).isEqualTo("Working");
    }
}
