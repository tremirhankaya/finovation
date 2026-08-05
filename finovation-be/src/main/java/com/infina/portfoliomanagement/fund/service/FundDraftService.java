package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class FundDraftService {

    private final FundDraftRepository fundDraftRepository;
    private final UserRepository userRepository;
    private final FundProperties fundProperties;
    private final Clock clock;

    @Transactional
    public FundDraftResponse createDraft(String actorUsername, CreateFundDraftRequest request) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        assertInitialSizeIsInRange(request.initialPortfolioSize());

        FundDraft draft = FundDraft.newDraft(
                request.initialPortfolioSize(),
                actor.getId(),
                LocalDateTime.now(clock)
        );

        FundDraft saved = fundDraftRepository.save(draft);

        log.info("Fund draft {} created by user {}", saved.getPublicId(), actor.getId());

        return FundDraftResponse.from(saved);
    }

    private void assertInitialSizeIsInRange(BigDecimal initialPortfolioSize) {
        boolean belowMinimum =
                initialPortfolioSize.compareTo(fundProperties.minInitialPortfolioSize()) < 0;
        boolean aboveMaximum =
                initialPortfolioSize.compareTo(fundProperties.maxInitialPortfolioSize()) > 0;

        if (belowMinimum || aboveMaximum) {
            throw new BaseException(ErrorCode.FUND_INITIAL_SIZE_OUT_OF_RANGE);
        }
    }
}
