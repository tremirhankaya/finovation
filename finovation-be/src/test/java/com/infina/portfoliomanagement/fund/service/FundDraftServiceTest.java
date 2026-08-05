package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FundDraftServiceTest {

    private static final BigDecimal MIN_SIZE = new BigDecimal("1000000");
    private static final BigDecimal MAX_SIZE = new BigDecimal("100000000000");
    private static final Instant FIXED_INSTANT = Instant.parse("2026-08-05T07:30:00Z");

    @Mock
    private FundDraftRepository fundDraftRepository;

    @Mock
    private UserRepository userRepository;

    private FundDraftService fundDraftService;

    private User actor;

    @BeforeEach
    void setUp() {
        fundDraftService = new FundDraftService(
                fundDraftRepository,
                userRepository,
                new FundProperties(MIN_SIZE, MAX_SIZE),
                Clock.fixed(FIXED_INSTANT, ZoneOffset.UTC)
        );

        actor = User.builder()
                .id(7L)
                .username("user1")
                .build();
    }

    @Test
    void validRequest_createsDraftWithSystemAssignedDefaults() {
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.save(any(FundDraft.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        FundDraftResponse response =
                fundDraftService.createDraft("user1", request("100000000"));

        assertThat(response.draftId()).isNotNull();
        assertThat(response.fundType()).isEqualTo(FundType.EQUITY_INTENSIVE);
        assertThat(response.currency()).isEqualTo("TRY");
        assertThat(response.status()).isEqualTo(FundDraftStatus.IN_PROGRESS);
        assertThat(response.initialPortfolioSize()).isEqualByComparingTo("100000000");
    }

    @Test
    void validRequest_leavesStrategyFieldsUnsetForTheNextStep() {
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.save(any(FundDraft.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        FundDraftResponse response =
                fundDraftService.createDraft("user1", request("100000000"));

        assertThat(response.name()).isNull();
        assertThat(response.managementApproach()).isNull();
        assertThat(response.liquidityTargetPct()).isNull();
    }

    @Test
    void validRequest_linksDraftToActorAndStampsFixedTime() {
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.save(any(FundDraft.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        fundDraftService.createDraft("user1", request("100000000"));

        ArgumentCaptor<FundDraft> captor = ArgumentCaptor.forClass(FundDraft.class);
        verify(fundDraftRepository).save(captor.capture());

        FundDraft saved = captor.getValue();
        LocalDateTime expectedTime = LocalDateTime.ofInstant(FIXED_INSTANT, ZoneOffset.UTC);

        assertThat(saved.getCreatedByUserId()).isEqualTo(7L);
        assertThat(saved.getPublicId()).isNotNull();
        assertThat(saved.getCreatedAt()).isEqualTo(expectedTime);
        assertThat(saved.getUpdatedAt()).isEqualTo(expectedTime);
    }

    @Test
    void sizeBelowMinimum_throwsOutOfRangeAndDoesNotSave() {
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> fundDraftService.createDraft("user1", request("999999")))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_INITIAL_SIZE_OUT_OF_RANGE);

        verifyNoInteractions(fundDraftRepository);
    }

    @Test
    void sizeAboveMaximum_throwsOutOfRangeAndDoesNotSave() {
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> fundDraftService.createDraft("user1", request("100000000001")))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_INITIAL_SIZE_OUT_OF_RANGE);

        verifyNoInteractions(fundDraftRepository);
    }

    @Test
    void sizeExactlyAtBounds_isAccepted() {
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.save(any(FundDraft.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(fundDraftService.createDraft("user1", request("1000000"))).isNotNull();
        assertThat(fundDraftService.createDraft("user1", request("100000000000"))).isNotNull();
    }

    @Test
    void getLimits_returnsConfiguredBounds() {
        var limits = fundDraftService.getLimits();

        assertThat(limits.minInitialPortfolioSize()).isEqualByComparingTo(MIN_SIZE);
        assertThat(limits.maxInitialPortfolioSize()).isEqualByComparingTo(MAX_SIZE);
    }

    @Test
    void unknownActor_throwsUserNotFoundAndDoesNotSave() {
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> fundDraftService.createDraft("missing", request("100000000")))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);

        verifyNoInteractions(fundDraftRepository);
    }

    private CreateFundDraftRequest request(String initialPortfolioSize) {
        return new CreateFundDraftRequest(new BigDecimal(initialPortfolioSize));
    }
}
