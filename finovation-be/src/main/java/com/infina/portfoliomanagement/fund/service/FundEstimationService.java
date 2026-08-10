package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.fund.dto.FundEstimatesResponse;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.fund.repository.FundPositionRepository;
import com.infina.portfoliomanagement.fundmonitoring.service.FundBenchmarkService.BenchmarkSnapshot;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationPoint;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationResult;
import com.infina.portfoliomanagement.fundmonitoring.service.FundBenchmarkService;
import com.infina.portfoliomanagement.fundmonitoring.service.FundMetricCalculator;
import com.infina.portfoliomanagement.fundmonitoring.service.FundValuationCalculator;
import com.infina.portfoliomanagement.fundmonitoring.service.RiskFreeRateProvider;
import com.infina.portfoliomanagement.fundmonitoring.valuation.AssetValuationProviderRegistry;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FundEstimationService {
    private static final int ANNUAL_HISTORY_LOOKBACK_BUFFER_DAYS = 45;

    private final FundDraftRepository fundDraftRepository;
    private final FundPortfolioRepository fundPortfolioRepository;
    private final FundPositionRepository fundPositionRepository;
    private final AssetRepository assetRepository;
    private final UserRepository userRepository;
    private final AssetValuationProviderRegistry valuationProviderRegistry;
    private final FundValuationCalculator valuationCalculator;
    private final FundBenchmarkService benchmarkService;
    private final RiskFreeRateProvider riskFreeRateProvider;
    private final FundMetricCalculator metricCalculator;
    private final FinancialTimeProvider financialTime;

    @Transactional(readOnly = true)
    public FundEstimatesResponse estimateDraft(String actorUsername, UUID draftId) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
        FundDraft draft = fundDraftRepository.findByPublicId(draftId)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_DRAFT_NOT_FOUND));
        
        if (!draft.getCreatedByUserId().equals(actor.getId())) {
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }

        FundPortfolio working = fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(draft.getId(), PortfolioType.WORKING)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_ANALYSIS_NOT_FOUND));

        List<FundPosition> positions = fundPositionRepository
                .findAllByFundPortfolioIdOrderByWeightDesc(working.getId());

        if (positions.isEmpty()) {
            return new FundEstimatesResponse(null, null, null, null);
        }

        List<Long> assetIds = positions.stream().map(FundPosition::getAssetId).toList();
        List<Asset> assets = assetRepository.findAllById(assetIds);
        
        LocalDate today = financialTime.currentDate();
        LocalDate startDate = today.minusYears(1).minusDays(ANNUAL_HISTORY_LOOKBACK_BUFFER_DAYS);

        Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValuesByAsset =
                valuationProviderRegistry.loadUnitValues(assets, startDate, today);

        FundValuationResult valuation = valuationCalculator.calculate(
                draft,
                positions,
                assets,
                unitValuesByAsset,
                startDate
        );

        List<FundValuationPoint> points = valuation.points();
        
        if (points.isEmpty()) {
            return new FundEstimatesResponse(null, null, null, null);
        }

        FundValuationPoint latest = valuation.latestPoint();
        BenchmarkSnapshot benchmarks = benchmarkService.load(latest.date());
        BigDecimal annualRiskFreeRate = riskFreeRateProvider.annualRate(latest.date());

        BigDecimal volatility = metricCalculator.annualizedVolatility(points);
        BigDecimal maxDrawdown = metricCalculator.maximumDrawdown(points);
        BigDecimal beta = metricCalculator.beta(points, benchmarks.benchmarkValues());
        BigDecimal sharpeRatio = metricCalculator.sharpeRatio(points, annualRiskFreeRate);

        return new FundEstimatesResponse(
                beta,
                volatility,
                sharpeRatio,
                maxDrawdown
        );
    }
}
