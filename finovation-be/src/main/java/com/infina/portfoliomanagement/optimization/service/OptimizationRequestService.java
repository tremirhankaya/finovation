package com.infina.portfoliomanagement.optimization.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.optimization.dto.AssetPreferenceRequest;
import com.infina.portfoliomanagement.optimization.dto.CreateOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.OptimizationRequestResponse;
import com.infina.portfoliomanagement.optimization.engine.EngineAssetLimit;
import com.infina.portfoliomanagement.optimization.engine.EngineAssetPreference;
import com.infina.portfoliomanagement.optimization.engine.EngineConstraintTarget;
import com.infina.portfoliomanagement.optimization.engine.OptimizationEngineClient;
import com.infina.portfoliomanagement.optimization.engine.OptimizationEngineRequest;
import com.infina.portfoliomanagement.optimization.engine.OptimizationEngineResult;
import com.infina.portfoliomanagement.optimization.entity.AssetPreference;
import com.infina.portfoliomanagement.optimization.entity.OptimizationRequest;
import com.infina.portfoliomanagement.optimization.entity.RequestConstraintTarget;
import com.infina.portfoliomanagement.optimization.enums.AssetPreferenceType;
import com.infina.portfoliomanagement.optimization.enums.OptimizationConstraintCode;
import com.infina.portfoliomanagement.optimization.enums.RequestStatus;
import com.infina.portfoliomanagement.optimization.policy.OptimizationRequestPolicy;
import com.infina.portfoliomanagement.optimization.repository.AssetLimitOverrideRepository;
import com.infina.portfoliomanagement.optimization.repository.AssetPreferenceRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationRequestRepository;
import com.infina.portfoliomanagement.optimization.repository.RequestConstraintTargetRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OptimizationRequestService {

    private static final BigDecimal EQUITY_WEIGHT_MIN_VALUE = BigDecimal.valueOf(85);
    private static final BigDecimal EQUITY_WEIGHT_MAX_VALUE = BigDecimal.valueOf(95);
    private static final BigDecimal SECTOR_MAX_VALUE = BigDecimal.valueOf(30);
    private static final BigDecimal SINGLE_STOCK_MAX_VALUE = BigDecimal.valueOf(10);
    private static final BigDecimal TPP_WEIGHT_FLOOR = BigDecimal.valueOf(5);
    private static final BigDecimal TPP_WEIGHT_CEILING = BigDecimal.valueOf(15);
    private static final BigDecimal TPP_WEIGHT_MIN_RANGE_WIDTH = BigDecimal.valueOf(3);
    private static final int STOCK_COUNT_FLOOR = 16;
    private static final int STOCK_COUNT_CEILING = 35;
    private static final int STOCK_COUNT_MIN_RANGE_WIDTH = 5;
    private static final BigDecimal FORCE_ADD_MINIMUM_WEIGHT = BigDecimal.ONE;

    private final OptimizationRequestRepository optimizationRequestRepository;
    private final RequestConstraintTargetRepository requestConstraintTargetRepository;
    private final AssetPreferenceRepository assetPreferenceRepository;
    private final AssetLimitOverrideRepository assetLimitOverrideRepository;
    private final UserRepository userRepository;
    private final OptimizationRequestPolicy optimizationRequestPolicy;
    private final OptimizationEngineClient optimizationEngineClient;
    private final Clock clock;

    @Transactional
    public OptimizationRequestResponse create(String actorUsername, CreateOptimizationRequestRequest requestBody) {
        User actor = resolveActor(actorUsername);

        assertWithinRange(
                requestBody.tppMinWeight(),
                requestBody.tppMaxWeight(),
                TPP_WEIGHT_FLOOR,
                TPP_WEIGHT_CEILING,
                TPP_WEIGHT_MIN_RANGE_WIDTH
        );
        assertCountWithinRange(
                requestBody.stockCountMin(),
                requestBody.stockCountMax(),
                STOCK_COUNT_FLOOR,
                STOCK_COUNT_CEILING,
                STOCK_COUNT_MIN_RANGE_WIDTH
        );
        assertPreferencesValid(requestBody.assetPreferences(), requestBody.stockCountMax());

        LocalDateTime now = LocalDateTime.now(clock);

        OptimizationRequest request = OptimizationRequest.builder()
                .fundId(requestBody.fundId())
                .requestedBy(actor)
                .riskProfile(requestBody.riskProfile())
                .status(RequestStatus.PREPARING)
                .version(0L)
                .createdAt(now)
                .updatedAt(now)
                .build();

        OptimizationRequest saved = optimizationRequestRepository.saveAndFlush(request);

        saveConstraintTargets(saved, requestBody);
        saveAssetPreferences(saved, requestBody.assetPreferences());

        log.debug("Optimization request {} created by actor {}", saved.getId(), actor.getId());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public OptimizationRequestResponse getById(String actorUsername, Long requestId) {
        User actor = resolveActor(actorUsername);
        OptimizationRequest request = findRequest(requestId);

        optimizationRequestPolicy.assertCanAccess(actor, request);

        return toResponse(request);
    }

    @Transactional(readOnly = true)
    public List<OptimizationRequestResponse> listByFund(String actorUsername, Long fundId) {
        User actor = resolveActor(actorUsername);

        List<OptimizationRequest> requests = actor.getRole() == Role.SUPER_ADMIN
                ? optimizationRequestRepository.findAllByFundId(fundId)
                : optimizationRequestRepository.findAllByFundIdAndRequestedById(fundId, actor.getId());

        return requests.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public OptimizationRequestResponse approve(String actorUsername, Long requestId) {
        User actor = resolveActor(actorUsername);
        OptimizationRequest request = findRequest(requestId);

        optimizationRequestPolicy.assertCanAccess(actor, request);
        assertStatusIn(request, RequestStatus.COMPLETED);

        request.setStatus(RequestStatus.APPROVED);
        request.setUpdatedAt(LocalDateTime.now(clock));
        OptimizationRequest saved = saveRequest(request);

        log.debug("Optimization request {} approved by actor {}", requestId, actor.getId());

        return toResponse(saved);
    }

    @Transactional
    public OptimizationRequestResponse reject(String actorUsername, Long requestId) {
        User actor = resolveActor(actorUsername);
        OptimizationRequest request = findRequest(requestId);

        optimizationRequestPolicy.assertCanAccess(actor, request);
        assertStatusIn(request, RequestStatus.COMPLETED);

        request.setStatus(RequestStatus.REJECTED);
        request.setUpdatedAt(LocalDateTime.now(clock));
        OptimizationRequest saved = saveRequest(request);

        log.debug("Optimization request {} rejected by actor {}", requestId, actor.getId());

        return toResponse(saved);
    }

    @Transactional
    public OptimizationRequestResponse run(String actorUsername, Long requestId) {
        User actor = resolveActor(actorUsername);
        OptimizationRequest request = findRequest(requestId);

        optimizationRequestPolicy.assertCanAccess(actor, request);
        assertStatusIn(request, RequestStatus.PREPARING, RequestStatus.FAILED);

        request.setStatus(RequestStatus.RUNNING);
        request.setStartedAt(LocalDateTime.now(clock));
        request.setErrorMessage(null);
        request.setUpdatedAt(LocalDateTime.now(clock));
        saveRequest(request);

        OptimizationEngineRequest engineRequest = buildEngineRequest(request);

        try {
            OptimizationEngineResult engineResult = optimizationEngineClient.run(engineRequest);

            request.setStatus(RequestStatus.COMPLETED);
            request.setModelVersion(engineResult.modelVersion());
            request.setCompletedAt(LocalDateTime.now(clock));
            request.setUpdatedAt(LocalDateTime.now(clock));
            OptimizationRequest saved = saveRequest(request);

            log.debug(
                    "Optimization request {} completed with engine model {}",
                    requestId,
                    engineResult.modelVersion()
            );

            return toResponse(saved);
        } catch (BaseException e) {
            request.setStatus(RequestStatus.FAILED);
            request.setErrorMessage(e.getMessage());
            request.setCompletedAt(LocalDateTime.now(clock));
            request.setUpdatedAt(LocalDateTime.now(clock));
            saveRequest(request);

            log.debug("Optimization request {} failed: {}", requestId, e.getMessage());

            throw e;
        }
    }

    private OptimizationEngineRequest buildEngineRequest(OptimizationRequest request) {
        List<EngineConstraintTarget> constraintTargets = requestConstraintTargetRepository
                .findAllByRequestId(request.getId())
                .stream()
                .map(target -> new EngineConstraintTarget(
                        target.getConstraintCode(),
                        target.getMinValue(),
                        target.getMaxValue()
                ))
                .toList();

        List<EngineAssetPreference> assetPreferences = assetPreferenceRepository
                .findAllByRequestId(request.getId())
                .stream()
                .filter(AssetPreference::isActive)
                .map(preference -> new EngineAssetPreference(
                        preference.getAssetCode(),
                        preference.getPreferenceType(),
                        preference.getFixedWeight()
                ))
                .toList();

        List<EngineAssetLimit> assetLimits = assetLimitOverrideRepository
                .findAllByRequestId(request.getId())
                .stream()
                .map(limit -> new EngineAssetLimit(
                        limit.getAssetCode(),
                        limit.getMinWeight(),
                        limit.getMaxWeight()
                ))
                .toList();

        return new OptimizationEngineRequest(
                request.getId(),
                request.getFundId(),
                constraintTargets,
                assetPreferences,
                assetLimits
        );
    }

    private void saveConstraintTargets(OptimizationRequest request, CreateOptimizationRequestRequest requestBody) {
        LocalDateTime now = LocalDateTime.now(clock);

        List<RequestConstraintTarget> targets = List.of(
                buildTarget(request, OptimizationConstraintCode.EQUITY_WEIGHT_MIN, EQUITY_WEIGHT_MIN_VALUE, null, now),
                buildTarget(request, OptimizationConstraintCode.EQUITY_WEIGHT_MAX, null, EQUITY_WEIGHT_MAX_VALUE, now),
                buildTarget(request, OptimizationConstraintCode.TPP_MIN, requestBody.tppMinWeight(), null, now),
                buildTarget(request, OptimizationConstraintCode.TPP_MAX, null, requestBody.tppMaxWeight(), now),
                buildTarget(request, OptimizationConstraintCode.SINGLE_STOCK_MAX, null, SINGLE_STOCK_MAX_VALUE, now),
                buildTarget(request, OptimizationConstraintCode.STOCK_COUNT_MIN, BigDecimal.valueOf(requestBody.stockCountMin()), null, now),
                buildTarget(request, OptimizationConstraintCode.STOCK_COUNT_MAX, null, BigDecimal.valueOf(requestBody.stockCountMax()), now),
                buildTarget(request, OptimizationConstraintCode.SECTOR_MAX, null, SECTOR_MAX_VALUE, now)
        );

        requestConstraintTargetRepository.saveAll(targets);
    }

    private RequestConstraintTarget buildTarget(
            OptimizationRequest request,
            OptimizationConstraintCode code,
            BigDecimal minValue,
            BigDecimal maxValue,
            LocalDateTime now
    ) {
        return RequestConstraintTarget.builder()
                .request(request)
                .constraintCode(code)
                .minValue(minValue)
                .maxValue(maxValue)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private void saveAssetPreferences(OptimizationRequest request, List<AssetPreferenceRequest> preferences) {
        if (preferences == null || preferences.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now(clock);

        List<AssetPreference> entities = preferences.stream()
                .map(preference -> AssetPreference.builder()
                        .request(request)
                        .assetCode(preference.assetCode())
                        .preferenceType(preference.preferenceType())
                        .currentWeight(preference.currentWeight())
                        .fixedWeight(resolveFixedWeight(preference))
                        .active(true)
                        .createdAt(now)
                        .updatedAt(now)
                        .build())
                .toList();

        assetPreferenceRepository.saveAll(entities);
    }

    private BigDecimal resolveFixedWeight(AssetPreferenceRequest preference) {
        return switch (preference.preferenceType()) {
            case KEEP -> preference.currentWeight();
            case FORCE_ADD -> FORCE_ADD_MINIMUM_WEIGHT;
            case EXCLUDE, CANDIDATE_ADD -> null;
        };
    }

    private void assertPreferencesValid(List<AssetPreferenceRequest> preferences, Integer stockCountMax) {
        if (preferences == null || preferences.isEmpty()) {
            return;
        }

        for (AssetPreferenceRequest preference : preferences) {
            if (preference.preferenceType() == AssetPreferenceType.KEEP && preference.currentWeight() == null) {
                throw new BaseException(
                        ErrorCode.OPT_INVALID_CONSTRAINT_VALUE,
                        "Current weight is required for a KEEP asset preference."
                );
            }
        }

        Set<String> excludedAssetCodes = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.EXCLUDE)
                .map(AssetPreferenceRequest::assetCode)
                .collect(Collectors.toSet());

        boolean hasExcludeForceAddConflict = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.FORCE_ADD)
                .map(AssetPreferenceRequest::assetCode)
                .anyMatch(excludedAssetCodes::contains);

        if (hasExcludeForceAddConflict) {
            throw new BaseException(
                    ErrorCode.OPT_ASSET_PREFERENCE_CONFLICT,
                    "An asset cannot be both excluded and force-added in the same request."
            );
        }

        long keepCount = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.KEEP)
                .count();

        if (keepCount > stockCountMax) {
            throw new BaseException(
                    ErrorCode.OPT_INVALID_CONSTRAINT_VALUE,
                    "The number of kept assets must not exceed the maximum stock count."
            );
        }

        BigDecimal keptWeightSum = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.KEEP)
                .map(AssetPreferenceRequest::currentWeight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long forceAddCount = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.FORCE_ADD)
                .count();

        BigDecimal reservedWeight = keptWeightSum.add(FORCE_ADD_MINIMUM_WEIGHT.multiply(BigDecimal.valueOf(forceAddCount)));

        if (reservedWeight.compareTo(EQUITY_WEIGHT_MAX_VALUE) > 0) {
            throw new BaseException(
                    ErrorCode.OPT_INVALID_CONSTRAINT_VALUE,
                    "Kept and force-added asset weights exceed the maximum usable equity weight."
            );
        }
    }

    private void assertWithinRange(
            BigDecimal min,
            BigDecimal max,
            BigDecimal floor,
            BigDecimal ceiling,
            BigDecimal minRangeWidth
    ) {
        if (min == null || max == null || min.compareTo(floor) < 0 || max.compareTo(ceiling) > 0
                || min.compareTo(max) > 0 || max.subtract(min).compareTo(minRangeWidth) < 0) {
            throw new BaseException(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
        }
    }

    private void assertCountWithinRange(Integer min, Integer max, int floor, int ceiling, int minRangeWidth) {
        if (min == null || max == null || min < floor || max > ceiling || min > max
                || max - min < minRangeWidth) {
            throw new BaseException(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
        }
    }

    private User resolveActor(String actorUsername) {
        return userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
    }

    private OptimizationRequest findRequest(Long requestId) {
        return optimizationRequestRepository.findById(requestId)
                .orElseThrow(() -> new BaseException(ErrorCode.OPT_REQUEST_NOT_FOUND));
    }

    private void assertStatusIn(OptimizationRequest request, RequestStatus... allowedStatuses) {
        for (RequestStatus allowedStatus : allowedStatuses) {
            if (request.getStatus() == allowedStatus) {
                return;
            }
        }

        log.debug(
                "Optimization request {} status transition denied: currentStatus={}",
                request.getId(),
                request.getStatus()
        );
        throw new BaseException(ErrorCode.OPT_INVALID_STATUS_TRANSITION);
    }

    private OptimizationRequest saveRequest(OptimizationRequest request) {
        try {
            return optimizationRequestRepository.saveAndFlush(request);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw new BaseException(ErrorCode.OPT_VERSION_CONFLICT);
        }
    }

    private OptimizationRequestResponse toResponse(OptimizationRequest request) {
        User requestedBy = request.getRequestedBy();

        return new OptimizationRequestResponse(
                request.getId(),
                request.getFundId(),
                request.getDataTimestamp(),
                request.getModelVersion(),
                requestedBy != null ? requestedBy.getId() : null,
                requestedBy != null ? requestedBy.getUsername() : null,
                request.getRiskProfile(),
                request.getStatus(),
                request.getStartedAt(),
                request.getCompletedAt(),
                request.getErrorMessage(),
                request.getCreatedAt(),
                request.getUpdatedAt()
        );
    }
}
