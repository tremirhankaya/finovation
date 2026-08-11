package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.dto.ArchivedFundDraftResponse;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundCurrencyOption;
import com.infina.portfoliomanagement.fund.dto.FundDraftInitResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftPageResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftSearchCriteria;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftSummaryResponse;
import com.infina.portfoliomanagement.fund.dto.ModelUniverseAssetResponse;
import com.infina.portfoliomanagement.fund.dto.UpdateFundDraftPortfolioRulesRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.FundDraftAnalysisStateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundEngineCreateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAssetDto;
import com.infina.portfoliomanagement.fund.dto.analysis.UpdateWorkingPortfolioRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.WorkingPortfolioResponse;
import com.infina.portfoliomanagement.fund.entity.FundAssetPreference;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.ModelRun;
import com.infina.portfoliomanagement.fund.enums.FundAssetPreferenceType;
import com.infina.portfoliomanagement.fund.enums.FundCurrency;
import com.infina.portfoliomanagement.fund.enums.FundDesignInitPage;
import com.infina.portfoliomanagement.fund.enums.FundDesignMode;
import com.infina.portfoliomanagement.fund.enums.FundDesignSteps;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.enums.InvestmentHorizon;
import com.infina.portfoliomanagement.fund.enums.ManagementApproach;
import com.infina.portfoliomanagement.fund.repository.FundAssetPreferenceRepository;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.service.analysis.FundModelClient;
import com.infina.portfoliomanagement.fund.specification.FundDraftSpecifications;
import com.infina.portfoliomanagement.fund.support.FundRulesFingerprint;
import com.infina.portfoliomanagement.fund.validation.FundDraftValidator;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FundDraftService {

    private static final int MAX_PAGE_SIZE = 10;

    private final FundDraftRepository fundDraftRepository;
    private final UserRepository userRepository;
    private final FundDesignProfileService fundDesignProfileService;
    private final FundModelClient fundModelClient;
    private final FundConstraintService fundConstraintService;
    private final FundAnalysisPersistenceService fundAnalysisPersistenceService;
    private final FundDraftValidator fundDraftValidator;
    private final FundAssetPreferenceRepository fundAssetPreferenceRepository;
    private final AssetRepository assetRepository;
    private final EquityDetailRepository equityDetailRepository;
    private final FinancialTimeProvider financialTime;

    @Transactional(readOnly = true)
    public FundDraftInitResponse getInit(
            String actorUsername,
            FundDesignInitPage page,
            UUID draftId
    ) {
        FundProperties limits = fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE);

        return switch (page) {
            case START -> startInit(limits);
            case STRATEGY -> strategyInit(actorUsername, draftId, limits);
            case EDIT -> editInit(actorUsername, draftId, limits);
            case ANALYSIS -> analysisInit(actorUsername, draftId, limits);
            case ALTERNATIVES -> boundsInit(page, limits);
            case APPROVAL -> approvalInit(actorUsername, draftId, limits);
        };
    }

    @Transactional(readOnly = true)
    public List<ModelUniverseAssetResponse> listModelUniverse() {
        return loadModelUniverse();
    }

    private FundDraftInitResponse startInit(FundProperties limits) {
        return new FundDraftInitResponse(
                FundDesignInitPage.START,
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
                limits.sectorMaxPct(),
                limits.aboveThresholdPct(),
                limits.aboveThresholdSumMax(),
                limits.maxAssetPreferences(),
                null,
                null,
                null,
                null
        );
    }

    private FundDraftInitResponse strategyInit(
            String actorUsername,
            UUID draftId,
            FundProperties limits
    ) {
        if (draftId == null) {
            throw new BaseException(ErrorCode.FUND_INIT_PAGE_INVALID);
        }
        FundDraftResponse draft = toResponse(requireOwnedDraft(actorUsername, draftId));
        return new FundDraftInitResponse(
                FundDesignInitPage.STRATEGY,
                null,
                null,
                null,
                null,
                null,
                null,
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
                limits.sectorMaxPct(),
                limits.aboveThresholdPct(),
                limits.aboveThresholdSumMax(),
                limits.maxAssetPreferences(),
                draft,
                loadModelUniverse(),
                loadModelUniverseSectors(),
                null
        );
    }

    private FundDraftInitResponse editInit(
            String actorUsername,
            UUID draftId,
            FundProperties limits
    ) {
        if (draftId == null) {
            throw new BaseException(ErrorCode.FUND_INIT_PAGE_INVALID);
        }
        FundDraftResponse draft = toResponse(requireOwnedDraft(actorUsername, draftId));
        return new FundDraftInitResponse(
                FundDesignInitPage.EDIT,
                null,
                null,
                null,
                null,
                null,
                null,
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
                limits.sectorMaxPct(),
                limits.aboveThresholdPct(),
                limits.aboveThresholdSumMax(),
                limits.maxAssetPreferences(),
                draft,
                loadModelUniverse(),
                loadModelUniverseSectors(),
                findWorkingPortfolio(actorUsername, draftId)
        );
    }

    private FundDraftInitResponse approvalInit(
            String actorUsername,
            UUID draftId,
            FundProperties limits
    ) {
        if (draftId == null) {
            throw new BaseException(ErrorCode.FUND_INIT_PAGE_INVALID);
        }
        FundDraftResponse draft = toResponse(requireOwnedDraft(actorUsername, draftId));
        return new FundDraftInitResponse(
                FundDesignInitPage.APPROVAL,
                null,
                null,
                null,
                null,
                null,
                null,
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
                limits.sectorMaxPct(),
                limits.aboveThresholdPct(),
                limits.aboveThresholdSumMax(),
                limits.maxAssetPreferences(),
                draft,
                null,
                null,
                getWorkingPortfolio(actorUsername, draftId)
        );
    }

    private FundDraftInitResponse analysisInit(
            String actorUsername,
            UUID draftId,
            FundProperties limits
    ) {
        if (draftId == null) {
            throw new BaseException(ErrorCode.FUND_INIT_PAGE_INVALID);
        }
        FundDraftResponse draft = toResponse(requireOwnedDraft(actorUsername, draftId));
        return new FundDraftInitResponse(
                FundDesignInitPage.ANALYSIS,
                null,
                null,
                null,
                null,
                null,
                null,
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
                limits.sectorMaxPct(),
                limits.aboveThresholdPct(),
                limits.aboveThresholdSumMax(),
                limits.maxAssetPreferences(),
                draft,
                loadModelUniverse(),
                loadModelUniverseSectors(),
                null
        );
    }

    private FundDraftInitResponse boundsInit(FundDesignInitPage page, FundProperties limits) {
        return new FundDraftInitResponse(
                page,
                null,
                null,
                null,
                null,
                null,
                null,
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
                limits.sectorMaxPct(),
                limits.aboveThresholdPct(),
                limits.aboveThresholdSumMax(),
                limits.maxAssetPreferences(),
                null,
                null,
                null,
                null
        );
    }

    private List<ModelUniverseAssetResponse> cachedModelUniverse = null;

    private List<String> loadModelUniverseSectors() {
        return loadModelUniverse().stream()
                .map(ModelUniverseAssetResponse::sectorName)
                .filter(sector -> sector != null && !sector.isBlank())
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }

    private synchronized List<ModelUniverseAssetResponse> loadModelUniverse() {
        if (cachedModelUniverse != null) {
            return cachedModelUniverse;
        }

        List<Asset> assets = assetRepository
                .findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                        AssetType.EQUITY
                );
        if (assets.isEmpty()) {
            return List.of();
        }

        Map<Long, EquityDetail> equityDetailByAssetId = equityDetailRepository
                .findAllByAssetIdIn(assets.stream().map(Asset::getId).toList())
                .stream()
                .collect(Collectors.toMap(
                        EquityDetail::getAssetId,
                        detail -> detail,
                        (left, right) -> left
                ));

        cachedModelUniverse = assets.stream()
                .map(asset -> {
                    EquityDetail detail = equityDetailByAssetId.get(asset.getId());
                    return new ModelUniverseAssetResponse(
                            asset.getAssetCode(),
                            resolveDisplayName(asset, detail != null ? detail.getCompanyName() : null),
                            detail != null && detail.getSector() != null ? detail.getSector().getName() : null
                    );
                })
                .toList();
        return cachedModelUniverse;
    }

    @Transactional
    public FundDraftResponse createDraft(String actorUsername, CreateFundDraftRequest request) {
        User actor = requireActor(actorUsername);

        FundProperties limits = fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE);
        fundDraftValidator.assertCreateRequest(
                request.name(),
                request.initialPortfolioSize(),
                request.unitPrice(),
                limits
        );

        LocalDateTime now = financialTime.now();
        FundDraft draft = FundDraft.newDraft(
                request.name().trim(),
                request.initialPortfolioSize(),
                request.unitPrice(),
                request.designMode(),
                actor.getId(),
                now
        );
        FundDraft saved;
        try {
            saved = fundDraftRepository.save(draft);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw new BaseException(ErrorCode.FUND_NAME_ALREADY_EXISTS);
        }
        fundConstraintService.saveProfileConstraints(saved, limits, now);

        if (saved.getDesignMode() == FundDesignMode.MANUAL) {
            fundAnalysisPersistenceService.seedManualWorkingPortfolio(saved, limits);
        }

        log.info("Fund draft {} created by user {}", saved.getPublicId(), actor.getId());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public FundDraftResponse getDraft(String actorUsername, UUID draftId) {
        return toResponse(requireOwnedDraft(actorUsername, draftId));
    }

    @Transactional(readOnly = true)
    public List<FundDraftSummaryResponse> listInProgressDrafts(String actorUsername) {
        User actor = requireActor(actorUsername);
        return fundDraftRepository
                .findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
                        FundDraftStatus.IN_PROGRESS,
                        actor.getId()
                )
                .stream()
                .map(FundDraftSummaryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public FundDraftPageResponse searchDrafts(
            String actorUsername,
            FundDraftSearchCriteria criteria
    ) {
        assertPaginationIsValid(criteria.page(), criteria.size());

        User actor = requireActor(actorUsername);

        PageRequest pageRequest = PageRequest.of(
                criteria.page(),
                criteria.size(),
                criteria.toSort()
        );

        Page<FundDraft> drafts = fundDraftRepository.findAll(
                FundDraftSpecifications.from(actor.getId(), criteria),
                pageRequest
        );

        return new FundDraftPageResponse(
                drafts.getContent().stream().map(FundDraftSummaryResponse::from).toList(),
                drafts.getNumber(),
                drafts.getSize(),
                drafts.getTotalElements(),
                drafts.getTotalPages(),
                drafts.hasNext(),
                drafts.hasPrevious()
        );
    }

    private void assertPaginationIsValid(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new BaseException(
                    ErrorCode.VALIDATION_ERROR,
                    "Page must be non-negative and size must be between 1 and " + MAX_PAGE_SIZE + "."
            );
        }
    }

    @Transactional(readOnly = true)
    public FundDraftResponse updatePortfolioRules(
            String actorUsername,
            UUID draftId,
            UpdateFundDraftPortfolioRulesRequest request
    ) {
        FundDraft draft = requireEditableDraft(actorUsername, draftId);
        FundProperties limits = fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE);
        fundDraftValidator.assertPortfolioRulesAreValid(request, limits);

        List<String> excludedCodes = normalizeAssetCodes(request.excludedAssetCodes());
        List<String> forcedCodes = normalizeAssetCodes(request.forcedAssetCodes());
        Map<String, Asset> resolvedAssets = resolveUniverseAssets(excludedCodes, forcedCodes);
        fundDraftValidator.assertAssetPreferencesValid(
                excludedCodes,
                forcedCodes,
                request.minStockCount(),
                limits.maxAssetPreferences()
        );

        LocalDateTime now = financialTime.now();
        draft.setManagementApproach(request.managementApproach());
        draft.setTppMinPct(request.tppMinPct().shortValue());
        draft.setTppMaxPct(request.tppMaxPct().shortValue());
        draft.setPreferredTppPct(request.preferredTppPct().shortValue());
        draft.setLiquidityTargetPct(request.preferredTppPct().shortValue());
        draft.setMinStockCount(request.minStockCount().shortValue());
        draft.setMaxStockCount(request.maxStockCount().shortValue());
        draft.setEquityMinPct((short) limits.minEquityWeightPct());
        draft.setEquityMaxPct((short) limits.maxEquityWeightPct());
        draft.setSingleStockMaxPct((short) limits.maxSingleStockMaxPct());
        advanceCurrentStep(draft, FundDesignSteps.ANALYSIS);
        draft.setUpdatedAt(now);

        FundDraft saved = fundDraftRepository.save(draft);
        fundConstraintService.replacePortfolioRuleConstraints(
                saved,
                limits,
                request.minStockCount(),
                request.maxStockCount(),
                now
        );
        replaceAssetPreferences(saved.getId(), excludedCodes, forcedCodes, resolvedAssets, now);
        fundAnalysisPersistenceService.invalidateRunsForDraft(saved.getId());

        log.info(
                "Fund draft {} portfolio rules updated by user {}",
                saved.getPublicId(),
                draft.getCreatedByUserId()
        );
        return toResponse(saved, excludedCodes, forcedCodes);
    }

    @Transactional(readOnly = true)
    public FundDraftAnalysisStateResponse getAnalysisState(String actorUsername, UUID draftId) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        String fingerprint = currentFingerprint(draft);
        return fundAnalysisPersistenceService.loadState(draft, fingerprint);
    }

    public FundModelAnalysisResponse runAnalysis(String actorUsername, UUID draftId) {
        FundDraft draft = requireEditableDraft(actorUsername, draftId);
        fundDraftValidator.assertStrategyReadyForAnalysis(draft);

        String fingerprint = currentFingerprint(draft);
        FundDraftAnalysisStateResponse existing =
                fundAnalysisPersistenceService.loadState(draft, fingerprint);
        if (!existing.proposals().isEmpty()) {
            return new FundModelAnalysisResponse(existing.proposals());
        }

        FundModelAnalysisRequest request = toAnalysisRequest(draft);
        ModelRun run = fundAnalysisPersistenceService.startRun(draft, fingerprint);
        try {
            FundEngineCreateResponse response = fundModelClient.analyze(request);
            fundAnalysisPersistenceService.completeRun(run, draft, response, fingerprint);
            log.info(
                    "Fund draft {} analysis completed by user {} with {} proposals",
                    draft.getPublicId(),
                    draft.getCreatedByUserId(),
                    response.alternatives() == null ? 0 : response.alternatives().size()
            );
            
            FundDraftAnalysisStateResponse newState = fundAnalysisPersistenceService.loadState(draft, fingerprint);
            return new FundModelAnalysisResponse(newState.proposals());
        } catch (RuntimeException ex) {
            fundAnalysisPersistenceService.failRun(
                    run,
                    "ANALYSIS_FAILED",
                    ex.getMessage()
            );
            throw ex;
        }
    }

    @Transactional
    public FundDraftAnalysisStateResponse selectProposal(
            String actorUsername,
            UUID draftId,
            int rank
    ) {
        FundDraft draft = requireEditableDraft(actorUsername, draftId);
        String fingerprint = currentFingerprint(draft);
        FundDraftAnalysisStateResponse state =
                fundAnalysisPersistenceService.selectProposal(draft, fingerprint, rank);
        advanceCurrentStep(draft, FundDesignSteps.EDIT);
        draft.setUpdatedAt(financialTime.now());
        fundDraftRepository.save(draft);
        return state;
    }

    @Transactional(readOnly = true)
    public WorkingPortfolioResponse getWorkingPortfolio(String actorUsername, UUID draftId) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        return fundAnalysisPersistenceService.getWorking(draft);
    }

    private WorkingPortfolioResponse findWorkingPortfolio(String actorUsername, UUID draftId) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        return fundAnalysisPersistenceService.findWorking(draft).orElse(null);
    }

    @Transactional
    public WorkingPortfolioResponse updateWorkingPortfolio(
            String actorUsername,
            UUID draftId,
            List<FundModelAssetDto> assets
    ) {
        FundDraft draft = requireEditableDraft(actorUsername, draftId);
        FundProperties limits = fundDesignProfileService.getLimits(draft.getFundType());
        WorkingPortfolioResponse response = fundAnalysisPersistenceService.replaceWorking(
                draft,
                assets,
                limits
        );
        advanceCurrentStep(draft, FundDesignSteps.EDIT);
        draft.setUpdatedAt(financialTime.now());
        fundDraftRepository.save(draft);
        return response;
    }

    private String currentFingerprint(FundDraft draft) {
        return FundRulesFingerprint.fromDraft(
                draft,
                loadExcludedCodes(draft.getId()),
                loadForcedCodes(draft.getId())
        );
    }

    private FundDraftResponse toResponse(FundDraft draft) {
        return toResponse(draft, loadExcludedCodes(draft.getId()), loadForcedCodes(draft.getId()));
    }

    private FundDraftResponse toResponse(
            FundDraft draft,
            List<String> excludedCodes,
            List<String> forcedCodes
    ) {
        return FundDraftResponse.from(draft, excludedCodes, forcedCodes);
    }

    private void replaceAssetPreferences(
            Long draftId,
            List<String> excludedCodes,
            List<String> forcedCodes,
            Map<String, Asset> resolvedAssets,
            LocalDateTime now
    ) {
        fundAssetPreferenceRepository.deleteAllByFundDraftId(draftId);
        fundAssetPreferenceRepository.flush();

        List<FundAssetPreference> preferences = new ArrayList<>();
        for (String code : excludedCodes) {
            preferences.add(FundAssetPreference.builder()
                    .fundDraftId(draftId)
                    .assetId(resolvedAssets.get(code).getId())
                    .preferenceType(FundAssetPreferenceType.EXCLUDE)
                    .createdAt(now)
                    .build());
        }
        for (String code : forcedCodes) {
            preferences.add(FundAssetPreference.builder()
                    .fundDraftId(draftId)
                    .assetId(resolvedAssets.get(code).getId())
                    .preferenceType(FundAssetPreferenceType.INCLUDE)
                    .createdAt(now)
                    .build());
        }
        if (!preferences.isEmpty()) {
            fundAssetPreferenceRepository.saveAll(preferences);
        }
    }

    private List<String> loadExcludedCodes(Long draftId) {
        return loadPreferenceCodes(draftId, FundAssetPreferenceType.EXCLUDE);
    }

    private List<String> loadForcedCodes(Long draftId) {
        return loadPreferenceCodes(draftId, FundAssetPreferenceType.INCLUDE);
    }

    private List<String> loadPreferenceCodes(Long draftId, FundAssetPreferenceType type) {
        if (draftId == null) {
            return List.of();
        }
        return toAssetCodes(
                fundAssetPreferenceRepository
                        .findAllByFundDraftIdAndPreferenceType(draftId, type)
                        .stream()
                        .map(FundAssetPreference::getAssetId)
                        .toList()
        );
    }

    private List<String> toAssetCodes(List<Long> assetIds) {
        if (assetIds.isEmpty()) {
            return List.of();
        }
        Map<Long, String> byId = assetRepository.findAllById(assetIds).stream()
                .collect(Collectors.toMap(Asset::getId, Asset::getAssetCode));
        return assetIds.stream()
                .map(byId::get)
                .filter(code -> code != null && !code.isBlank())
                .sorted()
                .toList();
    }

    private List<String> normalizeAssetCodes(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String raw : codes) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String normalized = raw.trim().toUpperCase(Locale.ROOT);
            unique.putIfAbsent(normalized, normalized);
        }
        return List.copyOf(unique.values());
    }

    private Map<String, Asset> resolveUniverseAssets(
            List<String> excludedCodes,
            List<String> forcedCodes
    ) {
        Set<String> requested = new HashSet<>();
        requested.addAll(excludedCodes);
        requested.addAll(forcedCodes);
        if (requested.isEmpty()) {
            return Map.of();
        }

        Map<String, Asset> universeByCode = assetRepository
                .findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                        AssetType.EQUITY
                )
                .stream()
                .collect(Collectors.toMap(
                        asset -> asset.getAssetCode().toUpperCase(Locale.ROOT),
                        asset -> asset,
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        List<String> unknown = requested.stream()
                .filter(code -> !universeByCode.containsKey(code))
                .sorted()
                .toList();
        if (!unknown.isEmpty()) {
            throw new BaseException(ErrorCode.FUND_ASSET_PREFERENCE_INVALID);
        }

        Map<String, Asset> resolved = new LinkedHashMap<>();
        for (String code : requested) {
            resolved.put(code, universeByCode.get(code));
        }
        return resolved;
    }

    private void advanceCurrentStep(FundDraft draft, int step) {
        Short current = draft.getCurrentStep();
        if (current == null || current < step) {
            draft.setCurrentStep((short) step);
        }
    }

    private FundModelAnalysisRequest toAnalysisRequest(FundDraft draft) {
        InvestmentHorizon horizon =
                draft.getHorizon() != null ? draft.getHorizon() : InvestmentHorizon.M12;
        return new FundModelAnalysisRequest(
                horizon,
                draft.getMinStockCount().intValue(),
                draft.getMaxStockCount().intValue(),
                toWeightPct(draft.getTppMinPct()),
                toWeightPct(draft.getTppMaxPct()),
                loadForcedCodes(draft.getId()),
                loadExcludedCodes(draft.getId())
        );
    }

    private static BigDecimal toWeightPct(Short percent) {
        if (percent == null) return BigDecimal.ZERO;
        return BigDecimal.valueOf(percent.intValue())
                .divide(BigDecimal.valueOf(100), 4, java.math.RoundingMode.HALF_UP);
    }

    @Transactional
    public FundDraftResponse completeDraft(String actorUsername, UUID draftId) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        if (draft.getStatus() == FundDraftStatus.COMPLETED) {
            throw new BaseException(ErrorCode.FUND_DRAFT_ALREADY_COMPLETED);
        }

        FundProperties limits = fundDesignProfileService.getLimits(draft.getFundType());
        fundAnalysisPersistenceService.assertWorkingPortfolioIsCompliant(draft, limits);

        draft.setStatus(FundDraftStatus.COMPLETED);
        advanceCurrentStep(draft, FundDesignSteps.APPROVAL);
        draft.setUpdatedAt(financialTime.now());

        FundDraft saved = fundDraftRepository.save(draft);
        log.info("Fund draft {} completed by {}", saved.getPublicId(), actorUsername);

        return toResponse(saved);
    }

    @Transactional
    public void archiveDraft(String actorUsername, UUID draftId) {
        User actor = requireActor(actorUsername);
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);

        draft.setDeleted(true);
        draft.setDeletedByUserId(actor.getId());
        draft.setPinned(false);
        draft.setUpdatedAt(financialTime.now());
        fundDraftRepository.save(draft);

        log.info("Fund draft {} archived by {}", draftId, actorUsername);
    }

    @Transactional
    public void updatePinStatus(String actorUsername, UUID draftId, boolean pinned) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        draft.setPinned(pinned);
        draft.setUpdatedAt(financialTime.now());
        fundDraftRepository.save(draft);
    }

    @Transactional
    public FundDraftResponse cloneDeletedDraft(String actorUsername, UUID draftId, com.infina.portfoliomanagement.fund.dto.request.CloneDraftRequest request) {
        User actor = requireActor(actorUsername);

        FundDraft deletedDraft = fundDraftRepository.findDeletedOrActiveByPublicId(draftId)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_DRAFT_NOT_FOUND));

        if (!deletedDraft.isDeleted() || !deletedDraft.getCreatedByUserId().equals(actor.getId())) {
            throw new BaseException(ErrorCode.FUND_DRAFT_NOT_FOUND);
        }

        FundProperties cloneLimits =
                fundDesignProfileService.getLimits(deletedDraft.getFundType());
        fundDraftValidator.assertCreateRequest(
                request.getName(),
                request.getInitialPortfolioSize(),
                request.getUnitPrice(),
                cloneLimits
        );

        LocalDateTime now = financialTime.now();
        
        FundDraft newDraft = FundDraft.builder()
                .publicId(UUID.randomUUID())
                .name(request.getName())
                .fundType(deletedDraft.getFundType())
                .currencyCode(deletedDraft.getCurrencyCode())
                .initialPortfolioSize(request.getInitialPortfolioSize())
                .unitPrice(request.getUnitPrice())
                .managementApproach(ManagementApproach.CUSTOM)
                .liquidityTargetPct(deletedDraft.getLiquidityTargetPct())
                .horizon(deletedDraft.getHorizon())
                .tppMinPct(deletedDraft.getTppMinPct())
                .tppMaxPct(deletedDraft.getTppMaxPct())
                .preferredTppPct(deletedDraft.getPreferredTppPct())
                .minStockCount(deletedDraft.getMinStockCount())
                .maxStockCount(deletedDraft.getMaxStockCount())
                .equityMinPct(deletedDraft.getEquityMinPct())
                .equityMaxPct(deletedDraft.getEquityMaxPct())
                .singleStockMaxPct(deletedDraft.getSingleStockMaxPct())
                .status(FundDraftStatus.IN_PROGRESS)
                .designMode(FundDesignMode.MANUAL)
                .deleted(false)
                .pinned(false)
                .currentStep((short) FundDesignSteps.EDIT)
                .createdByUserId(actor.getId())
                .createdAt(now)
                .updatedAt(now)
                .build();

        try {
            fundDraftRepository.save(newDraft);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw new BaseException(ErrorCode.FUND_NAME_ALREADY_EXISTS);
        }

        List<FundAssetPreference> oldPrefs = fundAssetPreferenceRepository.findAllByFundDraftId(deletedDraft.getId());
        if (!oldPrefs.isEmpty()) {
            List<FundAssetPreference> newPrefs = oldPrefs.stream().map(p -> FundAssetPreference.builder()
                    .fundDraftId(newDraft.getId())
                    .assetId(p.getAssetId())
                    .preferenceType(p.getPreferenceType())
                    .createdAt(now)
                    .build()).toList();
            fundAssetPreferenceRepository.saveAll(newPrefs);
        }

        try {
            WorkingPortfolioResponse oldWorking = fundAnalysisPersistenceService.getWorking(deletedDraft);
            if (oldWorking != null && oldWorking.assets() != null && !oldWorking.assets().isEmpty()) {
                List<FundModelAssetDto> mappedAssets = oldWorking.assets().stream()
                        .map(a -> new FundModelAssetDto(
                                a.assetCode(),
                                a.weight(),
                                a.aiNote()
                        ))
                        .toList();
                
                FundProperties limits = fundDesignProfileService.getLimits(newDraft.getFundType());
                fundAnalysisPersistenceService.replaceWorking(newDraft, mappedAssets, limits);
            }
        } catch (Exception e) {
            log.warn("Failed to clone working portfolio for draft {}", draftId, e);
        }

        return toResponse(newDraft);
    }

    @Transactional(readOnly = true)
    public List<ArchivedFundDraftResponse> listArchivedDrafts(String actorUsername) {
        User actor = requireActor(actorUsername);

        return fundDraftRepository.findArchivedByOwnerId(actor.getId())
                .stream()
                .map(ArchivedFundDraftResponse::from)
                .toList();
    }

    private User requireActor(String actorUsername) {
        return userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
    }

    private FundDraft requireEditableDraft(String actorUsername, UUID draftId) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        if (draft.getStatus() == FundDraftStatus.COMPLETED) {
            throw new BaseException(ErrorCode.FUND_DRAFT_LOCKED);
        }
        return draft;
    }

    private FundDraft requireOwnedDraft(String actorUsername, UUID draftId) {
        User actor = requireActor(actorUsername);
        FundDraft draft = fundDraftRepository.findByPublicId(draftId)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_DRAFT_NOT_FOUND));
        if (!draft.getCreatedByUserId().equals(actor.getId())) {
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
        return draft;
    }

    private static String resolveDisplayName(Asset asset, String companyName) {
        if (asset.getDisplayName() != null && !asset.getDisplayName().isBlank()) {
            return asset.getDisplayName();
        }
        if (companyName != null && !companyName.isBlank()) {
            return companyName;
        }
        return asset.getAssetCode();
    }
}
