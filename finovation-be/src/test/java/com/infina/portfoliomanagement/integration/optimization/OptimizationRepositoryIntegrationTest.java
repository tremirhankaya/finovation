package com.infina.portfoliomanagement.integration.optimization;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.integration.AbstractIntegrationTest;
import com.infina.portfoliomanagement.optimization.entity.AssetLimitOverride;
import com.infina.portfoliomanagement.optimization.entity.AssetPreference;
import com.infina.portfoliomanagement.optimization.entity.OptimizationRequest;
import com.infina.portfoliomanagement.optimization.entity.OptimizationResult;
import com.infina.portfoliomanagement.optimization.entity.OptimizationResultAsset;
import com.infina.portfoliomanagement.optimization.entity.RequestConstraintTarget;
import com.infina.portfoliomanagement.optimization.enums.AssetPreferenceType;
import com.infina.portfoliomanagement.optimization.enums.RiskProfile;
import com.infina.portfoliomanagement.optimization.enums.RequestStatus;
import com.infina.portfoliomanagement.optimization.enums.ResultActionType;
import com.infina.portfoliomanagement.optimization.enums.OptimizationConstraintCode;
import com.infina.portfoliomanagement.optimization.repository.AssetLimitOverrideRepository;
import com.infina.portfoliomanagement.optimization.repository.AssetPreferenceRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationRequestRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationResultAssetRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationResultRepository;
import com.infina.portfoliomanagement.optimization.repository.RequestConstraintTargetRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OptimizationRepositoryIntegrationTest extends AbstractIntegrationTest {

    private static final UUID FUND_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OptimizationRequestRepository optimizationRequestRepository;

    @Autowired
    private AssetPreferenceRepository assetPreferenceRepository;

    @Autowired
    private AssetLimitOverrideRepository assetLimitOverrideRepository;

    @Autowired
    private OptimizationResultRepository optimizationResultRepository;

    @Autowired
    private OptimizationResultAssetRepository optimizationResultAssetRepository;

    @Autowired
    private RequestConstraintTargetRepository requestConstraintTargetRepository;

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
                .email("fon-yoneticisi@finovation.test")
                .username("fon-yoneticisi")
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

    private OptimizationRequest newRequest() {
        LocalDateTime now = LocalDateTime.now();

        OptimizationRequest request = OptimizationRequest.builder()
                .fundId(FUND_ID)
                .dataTimestamp(now)
                .modelVersion("v1")
                .requestedBy(fundManager)
                .riskProfile(RiskProfile.BALANCED)
                .status(RequestStatus.PREPARING)
                .version(0L)
                .createdAt(now)
                .updatedAt(now)
                .build();

        return optimizationRequestRepository.saveAndFlush(request);
    }

    @Test
    void optimizationRequest_saveAndFind_roundTrip() {
        OptimizationRequest saved = newRequest();

        Optional<OptimizationRequest> found =
                optimizationRequestRepository.findById(saved.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getFundId()).isEqualTo(FUND_ID);
        assertThat(found.get().getRiskProfile()).isEqualTo(RiskProfile.BALANCED);
        assertThat(found.get().getStatus()).isEqualTo(RequestStatus.PREPARING);
        assertThat(found.get().getRequestedBy().getId()).isEqualTo(fundManager.getId());
        assertThat(found.get().getVersion()).isZero();
    }

    @Test
    void assetPreference_duplicateAssetInSameRequest_violatesUniqueConstraint() {
        OptimizationRequest request = newRequest();
        LocalDateTime now = LocalDateTime.now();

        AssetPreference first = AssetPreference.builder()
                .request(request)
                .assetCode("AKBNK")
                .preferenceType(AssetPreferenceType.KEEP)
                .active(true)
                .createdAt(now)
                .updatedAt(now)
                .build();

        assetPreferenceRepository.saveAndFlush(first);

        AssetPreference duplicate = AssetPreference.builder()
                .request(request)
                .assetCode("AKBNK")
                .preferenceType(AssetPreferenceType.EXCLUDE)
                .active(true)
                .createdAt(now)
                .updatedAt(now)
                .build();

        assertThatThrownBy(() -> assetPreferenceRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void assetPreference_inactiveDuplicateAssetInSameRequest_isAllowed() {
        OptimizationRequest request = newRequest();
        LocalDateTime now = LocalDateTime.now();

        AssetPreference deactivated = AssetPreference.builder()
                .request(request)
                .assetCode("AKBNK")
                .preferenceType(AssetPreferenceType.KEEP)
                .active(false)
                .createdAt(now)
                .updatedAt(now)
                .build();

        assetPreferenceRepository.saveAndFlush(deactivated);

        AssetPreference replacement = AssetPreference.builder()
                .request(request)
                .assetCode("AKBNK")
                .preferenceType(AssetPreferenceType.EXCLUDE)
                .active(true)
                .createdAt(now)
                .updatedAt(now)
                .build();

        AssetPreference saved = assetPreferenceRepository.saveAndFlush(replacement);

        assertThat(saved.getId()).isNotNull();
        assertThat(assetPreferenceRepository.findAllByRequestId(request.getId())).hasSize(2);
    }

    @Test
    void requestConstraintTarget_minGreaterThanMax_violatesCheckConstraint() {
        OptimizationRequest request = newRequest();
        LocalDateTime now = LocalDateTime.now();

        RequestConstraintTarget invalid = RequestConstraintTarget.builder()
                .request(request)
                .constraintCode(OptimizationConstraintCode.STOCK_COUNT_MIN)
                .minValue(new BigDecimal("30"))
                .maxValue(new BigDecimal("10"))
                .createdAt(now)
                .updatedAt(now)
                .build();

        assertThatThrownBy(() -> requestConstraintTargetRepository.saveAndFlush(invalid))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void assetLimitOverride_minGreaterThanMax_violatesCheckConstraint() {
        OptimizationRequest request = newRequest();
        LocalDateTime now = LocalDateTime.now();

        AssetLimitOverride invalid = AssetLimitOverride.builder()
                .request(request)
                .assetCode("GARAN")
                .minWeight(new BigDecimal("0.20"))
                .maxWeight(new BigDecimal("0.10"))
                .createdAt(now)
                .updatedAt(now)
                .build();

        assertThatThrownBy(() -> assetLimitOverrideRepository.saveAndFlush(invalid))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void optimizationResultAsset_findAllByResultId_returnsRelatedRows() {
        OptimizationRequest request = newRequest();
        LocalDateTime now = LocalDateTime.now();

        OptimizationResult result = optimizationResultRepository.saveAndFlush(
                OptimizationResult.builder()
                        .request(request)
                        .generatedAt(now)
                        .createdAt(now)
                        .build()
        );

        OptimizationResultAsset akbnk = OptimizationResultAsset.builder()
                .result(result)
                .assetCode("AKBNK")
                .assetType(AssetType.EQUITY)
                .currentWeight(new BigDecimal("0.08"))
                .proposedWeight(new BigDecimal("0.06"))
                .changeAmount(new BigDecimal("-0.02"))
                .actionType(ResultActionType.DECREASE)
                .manuallyOverridden(false)
                .createdAt(now)
                .updatedAt(now)
                .build();

        OptimizationResultAsset tpp = OptimizationResultAsset.builder()
                .result(result)
                .assetCode("TPP")
                .assetType(AssetType.TPP)
                .currentWeight(new BigDecimal("0.02"))
                .proposedWeight(new BigDecimal("0.04"))
                .changeAmount(new BigDecimal("0.02"))
                .actionType(ResultActionType.INCREASE)
                .manuallyOverridden(false)
                .createdAt(now)
                .updatedAt(now)
                .build();

        optimizationResultAssetRepository.saveAndFlush(akbnk);
        optimizationResultAssetRepository.saveAndFlush(tpp);

        List<OptimizationResultAsset> rows =
                optimizationResultAssetRepository.findAllByResultId(result.getId());

        assertThat(rows).hasSize(2);
        assertThat(rows)
                .extracting(OptimizationResultAsset::getAssetCode)
                .containsExactlyInAnyOrder("AKBNK", "TPP");
    }
}
