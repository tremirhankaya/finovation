package com.infina.portfoliomanagement.integration.optimization;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.integration.AbstractIntegrationTest;
import com.infina.portfoliomanagement.optimization.dto.AssetPreferenceRequest;
import com.infina.portfoliomanagement.optimization.dto.CreateOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.OptimizationRequestResponse;
import com.infina.portfoliomanagement.optimization.entity.RequestConstraintTarget;
import com.infina.portfoliomanagement.optimization.enums.AssetPreferenceType;
import com.infina.portfoliomanagement.optimization.enums.OptimizationConstraintCode;
import com.infina.portfoliomanagement.optimization.enums.RequestStatus;
import com.infina.portfoliomanagement.optimization.enums.RiskProfile;
import com.infina.portfoliomanagement.optimization.repository.AssetLimitOverrideRepository;
import com.infina.portfoliomanagement.optimization.repository.AssetPreferenceRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationRequestRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationResultAssetRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationResultRepository;
import com.infina.portfoliomanagement.optimization.repository.RequestConstraintTargetRepository;
import com.infina.portfoliomanagement.optimization.service.OptimizationRequestService;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OptimizationRequestServiceIntegrationTest extends AbstractIntegrationTest {

    private static final String FUND_MANAGER_USERNAME = "fon-yoneticisi-service";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OptimizationRequestRepository optimizationRequestRepository;

    @Autowired
    private RequestConstraintTargetRepository requestConstraintTargetRepository;

    @Autowired
    private AssetPreferenceRepository assetPreferenceRepository;

    @Autowired
    private AssetLimitOverrideRepository assetLimitOverrideRepository;

    @Autowired
    private OptimizationResultRepository optimizationResultRepository;

    @Autowired
    private OptimizationResultAssetRepository optimizationResultAssetRepository;

    @Autowired
    private OptimizationRequestService optimizationRequestService;

    private User fundManager;

    @BeforeEach
    void setUpUser() {
        optimizationResultAssetRepository.deleteAll();
        optimizationResultRepository.deleteAll();
        assetLimitOverrideRepository.deleteAll();
        assetPreferenceRepository.deleteAll();
        requestConstraintTargetRepository.deleteAll();
        optimizationRequestRepository.deleteAll();
        userRepository.deleteAll();

        LocalDateTime now = LocalDateTime.now();

        User user = User.builder()
                .company(null)
                .firstName("Fon")
                .lastName("Yoneticisi")
                .email("fon-yoneticisi-service@finovation.test")
                .username(FUND_MANAGER_USERNAME)
                .password("irrelevant-for-this-test")
                .role(Role.ADMIN)
                .status(UserStatus.ACTIVE)
                .passwordChangeRequired(false)
                .deleted(false)
                .createdAt(now)
                .updatedAt(now)
                .credentialsChangedAt(now)
                .build();

        fundManager = userRepository.saveAndFlush(user);
    }

    private CreateOptimizationRequestRequest validRequest() {
        return new CreateOptimizationRequestRequest(
                1L,
                RiskProfile.BALANCED,
                List.of(
                        new AssetPreferenceRequest("AKBNK", AssetPreferenceType.KEEP, new BigDecimal("8")),
                        new AssetPreferenceRequest("MGROS", AssetPreferenceType.EXCLUDE, null),
                        new AssetPreferenceRequest("BIMAS", AssetPreferenceType.FORCE_ADD, null)
                ),
                new BigDecimal("5"),
                new BigDecimal("15"),
                16,
                35
        );
    }

    @Test
    void create_withValidPayload_persistsRequestConstraintTargetsAndPreferences() {
        OptimizationRequestResponse response =
                optimizationRequestService.create(fundManager.getUsername(), validRequest());

        assertThat(response.id()).isNotNull();
        assertThat(response.fundId()).isEqualTo(1L);
        assertThat(response.riskProfile()).isEqualTo(RiskProfile.BALANCED);
        assertThat(response.status()).isEqualTo(RequestStatus.PREPARING);
        assertThat(response.requestedByUsername()).isEqualTo(fundManager.getUsername());

        List<RequestConstraintTarget> targets =
                requestConstraintTargetRepository.findAllByRequestId(response.id());
        assertThat(targets).hasSize(8);

        RequestConstraintTarget equityWeightMin = targets.stream()
                .filter(target -> target.getConstraintCode() == OptimizationConstraintCode.EQUITY_WEIGHT_MIN)
                .findFirst()
                .orElseThrow();
        assertThat(equityWeightMin.getMinValue()).isEqualByComparingTo(new BigDecimal("85"));

        RequestConstraintTarget sectorMax = targets.stream()
                .filter(target -> target.getConstraintCode() == OptimizationConstraintCode.SECTOR_MAX)
                .findFirst()
                .orElseThrow();
        assertThat(sectorMax.getMaxValue()).isEqualByComparingTo(new BigDecimal("30"));

        RequestConstraintTarget singleStockMax = targets.stream()
                .filter(target -> target.getConstraintCode() == OptimizationConstraintCode.SINGLE_STOCK_MAX)
                .findFirst()
                .orElseThrow();
        assertThat(singleStockMax.getMaxValue()).isEqualByComparingTo(new BigDecimal("10"));

        assertThat(assetPreferenceRepository.findAllByRequestId(response.id())).hasSize(3);
    }

    @Test
    void create_withTppRangeOutsideAllowedBounds_throwsInvalidConstraintValue() {
        CreateOptimizationRequestRequest invalid = new CreateOptimizationRequestRequest(
                1L,
                RiskProfile.AGGRESSIVE,
                List.of(),
                new BigDecimal("2"),
                new BigDecimal("15"),
                16,
                35
        );

        assertThatThrownBy(() -> optimizationRequestService.create(FUND_MANAGER_USERNAME, invalid))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
    }

    @Test
    void create_withKeepPreferenceMissingCurrentWeight_throwsInvalidConstraintValue() {
        CreateOptimizationRequestRequest invalid = new CreateOptimizationRequestRequest(
                1L,
                RiskProfile.CONSERVATIVE,
                List.of(new AssetPreferenceRequest("AKBNK", AssetPreferenceType.KEEP, null)),
                new BigDecimal("5"),
                new BigDecimal("15"),
                16,
                35
        );

        assertThatThrownBy(() -> optimizationRequestService.create(FUND_MANAGER_USERNAME, invalid))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
    }

    @Test
    void create_withSameAssetExcludedAndForceAdded_throwsAssetPreferenceConflict() {
        CreateOptimizationRequestRequest invalid = new CreateOptimizationRequestRequest(
                1L,
                RiskProfile.BALANCED,
                List.of(
                        new AssetPreferenceRequest("MGROS", AssetPreferenceType.EXCLUDE, null),
                        new AssetPreferenceRequest("MGROS", AssetPreferenceType.FORCE_ADD, null)
                ),
                new BigDecimal("5"),
                new BigDecimal("15"),
                16,
                35
        );

        assertThatThrownBy(() -> optimizationRequestService.create(FUND_MANAGER_USERNAME, invalid))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.OPT_ASSET_PREFERENCE_CONFLICT);
    }

    @Test
    void create_withKeptAssetCountExceedingStockCountMax_throwsInvalidConstraintValue() {
        List<AssetPreferenceRequest> twentyTwoKeptAssets = IntStream.rangeClosed(1, 22)
                .mapToObj(i -> new AssetPreferenceRequest("STK" + i, AssetPreferenceType.KEEP, new BigDecimal("1")))
                .toList();

        CreateOptimizationRequestRequest invalid = new CreateOptimizationRequestRequest(
                1L,
                RiskProfile.BALANCED,
                twentyTwoKeptAssets,
                new BigDecimal("5"),
                new BigDecimal("15"),
                16,
                21
        );

        assertThatThrownBy(() -> optimizationRequestService.create(FUND_MANAGER_USERNAME, invalid))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
    }

    @Test
    void create_withKeptAndForceAddedWeightExceedingUsableEquity_throwsInvalidConstraintValue() {
        CreateOptimizationRequestRequest invalid = new CreateOptimizationRequestRequest(
                1L,
                RiskProfile.BALANCED,
                List.of(
                        new AssetPreferenceRequest("AKBNK", AssetPreferenceType.KEEP, new BigDecimal("50")),
                        new AssetPreferenceRequest("GARAN", AssetPreferenceType.KEEP, new BigDecimal("48"))
                ),
                new BigDecimal("5"),
                new BigDecimal("15"),
                16,
                35
        );

        assertThatThrownBy(() -> optimizationRequestService.create(FUND_MANAGER_USERNAME, invalid))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
    }

    @Test
    void create_withTppRangeNarrowerThanMinimumWidth_throwsInvalidConstraintValue() {
        CreateOptimizationRequestRequest invalid = new CreateOptimizationRequestRequest(
                1L,
                RiskProfile.BALANCED,
                List.of(),
                new BigDecimal("10"),
                new BigDecimal("12"),
                16,
                35
        );

        assertThatThrownBy(() -> optimizationRequestService.create(FUND_MANAGER_USERNAME, invalid))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
    }

    @Test
    void create_withStockCountRangeNarrowerThanMinimumWidth_throwsInvalidConstraintValue() {
        CreateOptimizationRequestRequest invalid = new CreateOptimizationRequestRequest(
                1L,
                RiskProfile.BALANCED,
                List.of(),
                new BigDecimal("5"),
                new BigDecimal("15"),
                16,
                19
        );

        assertThatThrownBy(() -> optimizationRequestService.create(FUND_MANAGER_USERNAME, invalid))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
    }

    @Test
    void create_withStockCountRangeBelowNewFloor_throwsInvalidConstraintValue() {
        CreateOptimizationRequestRequest invalid = new CreateOptimizationRequestRequest(
                1L,
                RiskProfile.BALANCED,
                List.of(),
                new BigDecimal("5"),
                new BigDecimal("15"),
                10,
                30
        );

        assertThatThrownBy(() -> optimizationRequestService.create(FUND_MANAGER_USERNAME, invalid))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
    }
}
