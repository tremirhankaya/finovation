package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import com.infina.portfoliomanagement.fund.dto.UpdateFundDraftPortfolioRulesRequest;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.enums.FundDesignInitPage;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.enums.ManagementApproach;
import com.infina.portfoliomanagement.fund.repository.FundAssetPreferenceRepository;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.service.analysis.FundModelClient;
import com.infina.portfoliomanagement.fund.validation.FundDraftValidator;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FundDraftServiceTest {

    private static final BigDecimal MIN_SIZE = new BigDecimal("1000000");
    private static final BigDecimal MAX_SIZE = new BigDecimal("100000000000");
    private static final BigDecimal MIN_UNIT_PRICE = new BigDecimal("1");
    private static final BigDecimal MAX_UNIT_PRICE = new BigDecimal("1000");
    private static final BigDecimal SECTOR_MAX_PCT = new BigDecimal("30");
    private static final Instant FIXED_INSTANT = Instant.parse("2026-08-05T07:30:00Z");

    @Mock
    private FundDraftRepository fundDraftRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FundDesignProfileService fundDesignProfileService;

    @Mock
    private FundModelClient fundModelClient;

    @Mock
    private FundConstraintService fundConstraintService;

    @Mock
    private FundAnalysisPersistenceService fundAnalysisPersistenceService;

    @Mock
    private FundAssetPreferenceRepository fundAssetPreferenceRepository;

    @Mock
    private AssetRepository assetRepository;

    @Mock
    private EquityDetailRepository equityDetailRepository;

    private FundDraftService fundDraftService;

    private User actor;
    private FundProperties limits;

    @BeforeEach
    void setUp() {
        limits = new FundProperties(
                MIN_SIZE,
                MAX_SIZE,
                MIN_UNIT_PRICE,
                MAX_UNIT_PRICE,
                5,
                15,
                10,
                30,
                3,
                10,
                85,
                95,
                SECTOR_MAX_PCT,
                3,
                5
        );

        fundDraftService = new FundDraftService(
                fundDraftRepository,
                userRepository,
                fundDesignProfileService,
                fundModelClient,
                fundConstraintService,
                fundAnalysisPersistenceService,
                new FundDraftValidator(),
                fundAssetPreferenceRepository,
                assetRepository,
                equityDetailRepository,
                Clock.fixed(FIXED_INSTANT, ZoneOffset.UTC)
        );

        actor = User.builder()
                .id(7L)
                .username("user1")
                .build();

        lenient().when(fundAssetPreferenceRepository.findAllByFundDraftIdAndPreferenceType(any(), any()))
                .thenReturn(List.of());
    }

    @Test
    void validRequest_createsDraftWithSystemAssignedDefaults() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.save(any(FundDraft.class)))
                .thenAnswer(invocation -> {
                    FundDraft draft = invocation.getArgument(0);
                    if (draft.getId() == null) {
                        draft.setId(42L);
                    }
                    return draft;
                });

        FundDraftResponse response =
                fundDraftService.createDraft("user1", request("100000000", "17"));

        assertThat(response.draftId()).isNotNull();
        assertThat(response.fundType()).isEqualTo(FundType.EQUITY_INTENSIVE);
        assertThat(response.currency()).isEqualTo("TRY");
        assertThat(response.status()).isEqualTo(FundDraftStatus.IN_PROGRESS);
        assertThat(response.initialPortfolioSize()).isEqualByComparingTo("100000000");
        assertThat(response.unitPrice()).isEqualByComparingTo("17");
        assertThat(response.name()).isEqualTo("Finovation Hisse Senedi Fonu");
        assertThat(response.excludedAssetCodes()).isEmpty();
        assertThat(response.forcedAssetCodes()).isEmpty();
    }

    @Test
    void validRequest_leavesStrategyFieldsUnsetForTheNextStep() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.save(any(FundDraft.class)))
                .thenAnswer(invocation -> {
                    FundDraft draft = invocation.getArgument(0);
                    draft.setId(42L);
                    return draft;
                });

        FundDraftResponse response =
                fundDraftService.createDraft("user1", request("100000000", "17"));

        assertThat(response.managementApproach()).isNull();
        assertThat(response.liquidityTargetPct()).isNull();
        assertThat(response.currentStep()).isEqualTo(2);
    }

    @Test
    void validRequest_linksDraftToActorAndStampsFixedTime() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.save(any(FundDraft.class)))
                .thenAnswer(invocation -> {
                    FundDraft draft = invocation.getArgument(0);
                    draft.setId(42L);
                    return draft;
                });

        fundDraftService.createDraft("user1", request("100000000", "17"));

        ArgumentCaptor<FundDraft> captor = ArgumentCaptor.forClass(FundDraft.class);
        verify(fundDraftRepository).save(captor.capture());

        FundDraft saved = captor.getValue();
        LocalDateTime expectedTime = LocalDateTime.ofInstant(FIXED_INSTANT, ZoneOffset.UTC);

        assertThat(saved.getCreatedByUserId()).isEqualTo(7L);
        assertThat(saved.getPublicId()).isNotNull();
        assertThat(saved.getUnitPrice()).isEqualByComparingTo("17");
        assertThat(saved.getCreatedAt()).isEqualTo(expectedTime);
        assertThat(saved.getUpdatedAt()).isEqualTo(expectedTime);
    }

    @Test
    void sizeBelowMinimum_throwsOutOfRangeAndDoesNotSave() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> fundDraftService.createDraft("user1", request("999999", "17")))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_INITIAL_SIZE_OUT_OF_RANGE);

        verifyNoInteractions(fundDraftRepository);
    }

    @Test
    void sizeAboveMaximum_throwsOutOfRangeAndDoesNotSave() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> fundDraftService.createDraft("user1", request("100000000001", "17")))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_INITIAL_SIZE_OUT_OF_RANGE);

        verifyNoInteractions(fundDraftRepository);
    }

    @Test
    void unitPriceBelowMinimum_throwsOutOfRangeAndDoesNotSave() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> fundDraftService.createDraft("user1", request("100000000", "0.5")))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_UNIT_PRICE_OUT_OF_RANGE);

        verifyNoInteractions(fundDraftRepository);
    }

    @Test
    void unitPriceAboveMaximum_throwsOutOfRangeAndDoesNotSave() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> fundDraftService.createDraft("user1", request("100000000", "1000.01")))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_UNIT_PRICE_OUT_OF_RANGE);

        verifyNoInteractions(fundDraftRepository);
    }

    @Test
    void sizeExactlyAtBounds_isAccepted() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.save(any(FundDraft.class)))
                .thenAnswer(invocation -> {
                    FundDraft draft = invocation.getArgument(0);
                    draft.setId(42L);
                    return draft;
                });

        assertThat(fundDraftService.createDraft("user1", request("1000000", "1"))).isNotNull();
        assertThat(fundDraftService.createDraft("user1", request("100000000000", "1000"))).isNotNull();
    }

    @Test
    void invalidFundName_throwsAndDoesNotSave() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> fundDraftService.createDraft(
                "user1",
                new CreateFundDraftRequest("Fon 2", MIN_SIZE, MIN_UNIT_PRICE)
        ))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_NAME_INVALID);

        verifyNoInteractions(fundDraftRepository);
    }

    @Test
    void getInit_start_returnsCurrenciesBoundsAndPortfolioRuleFrames() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);

        var response = fundDraftService.getInit("user1", FundDesignInitPage.START, null);

        assertThat(response.page()).isEqualTo(FundDesignInitPage.START);
        assertThat(response.currencies()).hasSize(1);
        assertThat(response.currencies().getFirst().code()).isEqualTo("TRY");
        assertThat(response.currencies().getFirst().label()).isEqualTo("TRY - Türk Lirası");
        assertThat(response.defaultCurrency()).isEqualTo("TRY");
        assertThat(response.minInitialPortfolioSize()).isEqualByComparingTo(MIN_SIZE);
        assertThat(response.maxInitialPortfolioSize()).isEqualByComparingTo(MAX_SIZE);
        assertThat(response.minUnitPrice()).isEqualByComparingTo(MIN_UNIT_PRICE);
        assertThat(response.maxUnitPrice()).isEqualByComparingTo(MAX_UNIT_PRICE);
        assertThat(response.minLiquidityTargetPct()).isEqualTo(5);
        assertThat(response.maxLiquidityTargetPct()).isEqualTo(15);
        assertThat(response.minTppRangePct()).isEqualTo(3);
        assertThat(response.minStockCount()).isEqualTo(10);
        assertThat(response.maxStockCount()).isEqualTo(30);
        assertThat(response.minStockCountRange()).isEqualTo(5);
        assertThat(response.minSingleStockMaxPct()).isEqualTo(3);
        assertThat(response.maxSingleStockMaxPct()).isEqualTo(10);
        assertThat(response.minEquityWeightPct()).isEqualTo(85);
        assertThat(response.maxEquityWeightPct()).isEqualTo(95);
        assertThat(response.sectorMaxPct()).isEqualByComparingTo(SECTOR_MAX_PCT);
        assertThat(response.draft()).isNull();
        assertThat(response.modelUniverse()).isNull();
    }

    @Test
    void getInit_strategy_withoutDraftId_rejects() {
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);

        assertThatThrownBy(() -> fundDraftService.getInit("user1", FundDesignInitPage.STRATEGY, null))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_INIT_PAGE_INVALID);
    }

    @Test
    void getDraft_returnsOwnedDraft() {
        FundDraft draft = existingDraft(7L);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.findByPublicId(draft.getPublicId())).thenReturn(Optional.of(draft));
        when(fundAssetPreferenceRepository.findAllByFundDraftIdAndPreferenceType(any(), any()))
                .thenReturn(List.of());

        FundDraftResponse response = fundDraftService.getDraft("user1", draft.getPublicId());

        assertThat(response.draftId()).isEqualTo(draft.getPublicId());
        assertThat(response.initialPortfolioSize()).isEqualByComparingTo("100000000");
        assertThat(response.unitPrice()).isEqualByComparingTo("17");
        assertThat(response.status()).isEqualTo(FundDraftStatus.IN_PROGRESS);
        assertThat(response.managementApproach()).isNull();
        assertThat(response.excludedAssetCodes()).isEmpty();
        assertThat(response.forcedAssetCodes()).isEmpty();
    }

    @Test
    void getDraft_missingDraft_throwsNotFound() {
        UUID draftId = UUID.fromString("11111111-1111-1111-1111-111111111111");
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.findByPublicId(draftId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> fundDraftService.getDraft("user1", draftId))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_DRAFT_NOT_FOUND);
    }

    @Test
    void getDraft_otherUsersDraft_throwsAccessDenied() {
        FundDraft draft = existingDraft(99L);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.findByPublicId(draft.getPublicId())).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> fundDraftService.getDraft("user1", draft.getPublicId()))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    @Test
    void updatePortfolioRules_persistsUserChoicesAndProfileCaps() {
        FundDraft draft = existingDraft(7L);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.findByPublicId(draft.getPublicId())).thenReturn(Optional.of(draft));
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);
        when(fundDraftRepository.save(any(FundDraft.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UpdateFundDraftPortfolioRulesRequest request = new UpdateFundDraftPortfolioRulesRequest(
                ManagementApproach.PROTECTIVE,
                5,
                10,
                8,
                25,
                30,
                List.of(),
                List.of()
        );

        FundDraftResponse response =
                fundDraftService.updatePortfolioRules("user1", draft.getPublicId(), request);

        assertThat(response.managementApproach()).isEqualTo(ManagementApproach.PROTECTIVE);
        assertThat(response.tppMinPct()).isEqualTo((short) 5);
        assertThat(response.tppMaxPct()).isEqualTo((short) 10);
        assertThat(response.preferredTppPct()).isEqualTo((short) 8);
        assertThat(response.liquidityTargetPct()).isEqualTo((short) 8);
        assertThat(response.minStockCount()).isEqualTo((short) 25);
        assertThat(response.maxStockCount()).isEqualTo((short) 30);
        assertThat(response.equityMinPct()).isEqualTo((short) 85);
        assertThat(response.equityMaxPct()).isEqualTo((short) 95);
        assertThat(response.singleStockMaxPct()).isEqualTo((short) 10);
        assertThat(response.currentStep()).isEqualTo(3);

        ArgumentCaptor<FundDraft> captor = ArgumentCaptor.forClass(FundDraft.class);
        verify(fundDraftRepository).save(captor.capture());
        assertThat(captor.getValue().getPreferredTppPct()).isEqualTo((short) 8);
    }

    @Test
    void updatePortfolioRules_outOfBounds_throwsAndDoesNotSave() {
        FundDraft draft = existingDraft(7L);
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.findByPublicId(draft.getPublicId())).thenReturn(Optional.of(draft));
        when(fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE)).thenReturn(limits);

        UpdateFundDraftPortfolioRulesRequest request = new UpdateFundDraftPortfolioRulesRequest(
                ManagementApproach.ATTACK,
                5,
                6,
                5,
                16,
                21,
                null,
                null
        );

        assertThatThrownBy(
                () -> fundDraftService.updatePortfolioRules("user1", draft.getPublicId(), request)
        )
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.FUND_PORTFOLIO_RULES_INVALID);

        verify(fundDraftRepository).findByPublicId(draft.getPublicId());
        verify(fundDraftRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void unknownActor_throwsUserNotFoundAndDoesNotSave() {
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> fundDraftService.createDraft("missing", request("100000000", "17")))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);

        verifyNoInteractions(fundDraftRepository);
    }

    private CreateFundDraftRequest request(String initialPortfolioSize, String unitPrice) {
        return new CreateFundDraftRequest(
                "Finovation Hisse Senedi Fonu",
                new BigDecimal(initialPortfolioSize),
                new BigDecimal(unitPrice)
        );
    }

    private FundDraft existingDraft(Long ownerId) {
        LocalDateTime now = LocalDateTime.ofInstant(FIXED_INSTANT, ZoneOffset.UTC);
        return FundDraft.builder()
                .id(1L)
                .publicId(UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"))
                .version(0)
                .fundType(FundType.EQUITY_INTENSIVE)
                .currencyCode(FundDraft.DEFAULT_CURRENCY_CODE)
                .initialPortfolioSize(new BigDecimal("100000000"))
                .unitPrice(new BigDecimal("17"))
                .status(FundDraftStatus.IN_PROGRESS)
                .currentStep((short) 2)
                .createdByUserId(ownerId)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
