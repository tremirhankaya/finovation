package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundCurrencyOption;
import com.infina.portfoliomanagement.fund.dto.FundDraftInitResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.enums.FundCurrency;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.validation.FundNameRules;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class FundDraftService {

    private final FundDraftRepository fundDraftRepository;
    private final UserRepository userRepository;
    private final FundDesignProfileService fundDesignProfileService;
    private final Clock clock;

    @Transactional(readOnly = true)
    public FundDraftInitResponse getInit() {
        FundProperties limits = fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE);
        return new FundDraftInitResponse(
                FundCurrencyOption.all(),
                FundCurrency.TRY.getCode(),
                limits.minInitialPortfolioSize(),
                limits.maxInitialPortfolioSize(),
                limits.minUnitPrice(),
                limits.maxUnitPrice(),
                limits.minLiquidityTargetPct(),
                limits.maxLiquidityTargetPct(),
                limits.minTppRangePct(),
                limits.minStockCount(),
                limits.maxStockCount(),
                limits.minStockCountRange(),
                limits.minSingleStockMaxPct(),
                limits.maxSingleStockMaxPct(),
                limits.minEquityWeightPct(),
                limits.maxEquityWeightPct(),
                limits.sectorMaxPct()
        );
    }

    @Transactional
    public FundDraftResponse createDraft(String actorUsername, CreateFundDraftRequest request) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        FundProperties limits = fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE);
        assertFundNameIsValid(request.name());
        assertInitialSizeIsInRange(request.initialPortfolioSize(), limits);
        assertUnitPriceIsInRange(request.unitPrice(), limits);

        FundDraft draft = FundDraft.newDraft(
                request.name().trim(),
                request.initialPortfolioSize(),
                request.unitPrice(),
                actor.getId(),
                LocalDateTime.now(clock)
        );

        FundDraft saved = fundDraftRepository.save(draft);

        log.info("Fund draft {} created by user {}", saved.getPublicId(), actor.getId());

        return FundDraftResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public FundDraftResponse getDraft(String actorUsername, UUID draftId) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        FundDraft draft = fundDraftRepository.findByPublicId(draftId)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_DRAFT_NOT_FOUND));

        if (!draft.getCreatedByUserId().equals(actor.getId())) {
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }

        return FundDraftResponse.from(draft);
    }

    private void assertFundNameIsValid(String name) {
        if (!FundNameRules.isValid(name)) {
            throw new BaseException(ErrorCode.FUND_NAME_INVALID);
        }
    }

    private void assertInitialSizeIsInRange(BigDecimal initialPortfolioSize, FundProperties limits) {
        boolean belowMinimum =
                initialPortfolioSize.compareTo(limits.minInitialPortfolioSize()) < 0;
        boolean aboveMaximum =
                initialPortfolioSize.compareTo(limits.maxInitialPortfolioSize()) > 0;

        if (belowMinimum || aboveMaximum) {
            throw new BaseException(ErrorCode.FUND_INITIAL_SIZE_OUT_OF_RANGE);
        }
    }

    private void assertUnitPriceIsInRange(BigDecimal unitPrice, FundProperties limits) {
        boolean belowMinimum = unitPrice.compareTo(limits.minUnitPrice()) < 0;
        boolean aboveMaximum = unitPrice.compareTo(limits.maxUnitPrice()) > 0;

        if (belowMinimum || aboveMaximum) {
            throw new BaseException(ErrorCode.FUND_UNIT_PRICE_OUT_OF_RANGE);
        }
    }
}
