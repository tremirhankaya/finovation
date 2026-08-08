package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.dto.analysis.FundDraftAnalysisStateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAssetDto;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelProposalDto;
import com.infina.portfoliomanagement.fund.dto.analysis.WorkingPortfolioResponse;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fund.entity.ModelRun;
import com.infina.portfoliomanagement.fund.enums.FundDesignSteps;
import com.infina.portfoliomanagement.fund.enums.ModelRunStatus;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.fund.repository.FundPositionRepository;
import com.infina.portfoliomanagement.fund.repository.ModelRunRepository;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FundAnalysisPersistenceService {

    private final ModelRunRepository modelRunRepository;
    private final FundPortfolioRepository fundPortfolioRepository;
    private final FundPositionRepository fundPositionRepository;
    private final FundDraftRepository fundDraftRepository;
    private final AssetRepository assetRepository;
    private final Clock clock;

    @Transactional
    public void invalidateRunsForDraft(Long draftId) {
        LocalDateTime now = LocalDateTime.now(clock);
        List<ModelRun> completed = modelRunRepository
                .findAllByFundDraft_IdAndStatus(draftId, ModelRunStatus.COMPLETED);
        for (ModelRun run : completed) {
            run.setStatus(ModelRunStatus.SUPERSEDED);
            run.setUpdatedAt(now);
        }
        if (!completed.isEmpty()) {
            modelRunRepository.saveAll(completed);
        }

        List<FundPortfolio> selected =
                fundPortfolioRepository.findAllByFundDraft_IdAndSelectedTrue(draftId);
        for (FundPortfolio portfolio : selected) {
            portfolio.setSelected(false);
            portfolio.setUpdatedAt(now);
        }
        if (!selected.isEmpty()) {
            fundPortfolioRepository.saveAll(selected);
        }

        fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(draftId, PortfolioType.WORKING)
                .ifPresent(this::deletePortfolioWithPositions);
    }

    @Transactional
    public ModelRun startRun(FundDraft draft, String rulesFingerprint) {
        LocalDateTime now = LocalDateTime.now(clock);
        invalidateRunsForDraft(draft.getId());

        ModelRun run = ModelRun.builder()
                .fundDraft(draft)
                .status(ModelRunStatus.GENERATING_PROPOSALS)
                .dataCutoffDate(LocalDate.now(clock))
                .modelVersion("mock-v1")
                .rulesFingerprint(rulesFingerprint)
                .startedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        return modelRunRepository.save(run);
    }

    @Transactional
    public void completeRun(
            ModelRun run,
            FundDraft draft,
            FundModelAnalysisResponse response,
            String rulesFingerprint
    ) {
        LocalDateTime now = LocalDateTime.now(clock);
        List<FundModelProposalDto> proposals =
                response.proposals() == null ? List.of() : response.proposals();

        Map<String, Asset> assetsByCode = resolveAssets(
                proposals.stream()
                        .flatMap(proposal -> proposal.assets().stream())
                        .map(FundModelAssetDto::assetCode)
                        .toList()
        );

        for (FundModelProposalDto proposal : proposals) {
            FundPortfolio portfolio = FundPortfolio.builder()
                    .publicId(UUID.randomUUID())
                    .version(0)
                    .fundDraft(draft)
                    .modelRunId(run.getId())
                    .portfolioType(PortfolioType.PROPOSAL)
                    .proposalRank(proposal.rank().shortValue())
                    .selected(false)
                    .label(proposal.label())
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            FundPortfolio saved = fundPortfolioRepository.save(portfolio);
            savePositions(saved, proposal.assets(), assetsByCode, now);
        }

        run.setStatus(ModelRunStatus.COMPLETED);
        run.setRulesFingerprint(rulesFingerprint);
        run.setCompletedAt(now);
        run.setUpdatedAt(now);
        modelRunRepository.save(run);

        if (draft.getCurrentStep() == null
                || draft.getCurrentStep() < FundDesignSteps.ALTERNATIVES) {
            draft.setCurrentStep((short) FundDesignSteps.ALTERNATIVES);
        }
        draft.setUpdatedAt(now);
        fundDraftRepository.save(draft);
    }

    @Transactional
    public void failRun(ModelRun run, String errorCode, String message) {
        LocalDateTime now = LocalDateTime.now(clock);
        run.setStatus(ModelRunStatus.FAILED);
        run.setErrorCode(errorCode);
        run.setErrorMessage(message == null ? null : message.substring(0, Math.min(500, message.length())));
        run.setCompletedAt(now);
        run.setUpdatedAt(now);
        modelRunRepository.save(run);
    }

    @Transactional(readOnly = true)
    public FundDraftAnalysisStateResponse loadState(FundDraft draft, String rulesFingerprint) {
        ModelRun run = modelRunRepository
                .findFirstByFundDraft_IdAndStatusAndRulesFingerprintOrderByIdDesc(
                        draft.getId(),
                        ModelRunStatus.COMPLETED,
                        rulesFingerprint
                )
                .orElse(null);

        if (run == null) {
            return new FundDraftAnalysisStateResponse(rulesFingerprint, List.of(), null);
        }

        List<FundPortfolio> portfolios = fundPortfolioRepository
                .findAllByModelRunIdAndPortfolioTypeOrderByProposalRankAsc(
                        run.getId(),
                        PortfolioType.PROPOSAL
                );

        List<FundModelProposalDto> proposals = portfolios.stream()
                .map(this::toProposalDto)
                .toList();

        Integer selectedRank = portfolios.stream()
                .filter(FundPortfolio::isSelected)
                .map(portfolio -> portfolio.getProposalRank() == null
                        ? null
                        : portfolio.getProposalRank().intValue())
                .findFirst()
                .orElse(null);

        return new FundDraftAnalysisStateResponse(rulesFingerprint, proposals, selectedRank);
    }

    @Transactional
    public FundDraftAnalysisStateResponse selectProposal(
            FundDraft draft,
            String rulesFingerprint,
            int rank
    ) {
        ModelRun run = modelRunRepository
                .findFirstByFundDraft_IdAndStatusAndRulesFingerprintOrderByIdDesc(
                        draft.getId(),
                        ModelRunStatus.COMPLETED,
                        rulesFingerprint
                )
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_ANALYSIS_NOT_FOUND));

        FundPortfolio proposal = fundPortfolioRepository
                .findByModelRunIdAndProposalRank(run.getId(), (short) rank)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_PROPOSAL_NOT_FOUND));

        LocalDateTime now = LocalDateTime.now(clock);
        List<FundPortfolio> previouslySelected =
                fundPortfolioRepository.findAllByFundDraft_IdAndSelectedTrue(draft.getId());
        for (FundPortfolio portfolio : previouslySelected) {
            portfolio.setSelected(false);
            portfolio.setUpdatedAt(now);
        }
        if (!previouslySelected.isEmpty()) {
            fundPortfolioRepository.saveAll(previouslySelected);
        }
        proposal.setSelected(true);
        proposal.setUpdatedAt(now);
        fundPortfolioRepository.save(proposal);

        List<FundModelAssetDto> assets = toProposalDto(proposal).assets();
        upsertWorking(draft, proposal.getLabel(), assets, now);

        return loadState(draft, rulesFingerprint);
    }

    @Transactional(readOnly = true)
    public WorkingPortfolioResponse getWorking(FundDraft draft) {
        FundPortfolio working = fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(draft.getId(), PortfolioType.WORKING)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_ANALYSIS_NOT_FOUND));

        Integer sourceRank = fundPortfolioRepository
                .findByFundDraftIdAndSelectedTrue(draft.getId())
                .map(FundPortfolio::getProposalRank)
                .map(Short::intValue)
                .orElse(null);

        return new WorkingPortfolioResponse(
                sourceRank,
                working.getLabel(),
                toProposalDto(working).assets()
        );
    }

    @Transactional
    public WorkingPortfolioResponse replaceWorking(
            FundDraft draft,
            List<FundModelAssetDto> assets
    ) {
        if (assets == null || assets.isEmpty()) {
            throw new BaseException(ErrorCode.FUND_WORKING_PORTFOLIO_INVALID);
        }
        LocalDateTime now = LocalDateTime.now(clock);
        FundPortfolio selected = fundPortfolioRepository
                .findByFundDraftIdAndSelectedTrue(draft.getId())
                .orElse(null);
        String label = selected != null && selected.getLabel() != null
                ? selected.getLabel()
                : "Working";
        upsertWorking(draft, label, assets, now);
        return getWorking(draft);
    }

    private void upsertWorking(
            FundDraft draft,
            String label,
            List<FundModelAssetDto> assets,
            LocalDateTime now
    ) {
        Map<String, Asset> assetsByCode = resolveAssets(
                assets.stream().map(FundModelAssetDto::assetCode).toList()
        );

        FundPortfolio working = fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(draft.getId(), PortfolioType.WORKING)
                .orElseGet(() -> FundPortfolio.builder()
                        .publicId(UUID.randomUUID())
                        .version(0)
                        .fundDraft(draft)
                        .modelRunId(null)
                        .portfolioType(PortfolioType.WORKING)
                        .proposalRank(null)
                        .selected(false)
                        .createdAt(now)
                        .build());

        working.setLabel(label);
        working.setUpdatedAt(now);
        FundPortfolio saved = fundPortfolioRepository.save(working);

        fundPositionRepository.deleteAllByFundPortfolioId(saved.getId());
        fundPositionRepository.flush();
        savePositions(saved, assets, assetsByCode, now);
    }

    private void savePositions(
            FundPortfolio portfolio,
            List<FundModelAssetDto> assets,
            Map<String, Asset> assetsByCode,
            LocalDateTime now
    ) {
        List<FundPosition> rows = new ArrayList<>();
        for (FundModelAssetDto assetDto : assets) {
            String code = normalizeCode(assetDto.assetCode());
            Asset asset = assetsByCode.get(code);
            if (asset == null) {
                throw new BaseException(ErrorCode.FUND_WORKING_PORTFOLIO_INVALID);
            }
            rows.add(FundPosition.builder()
                    .fundPortfolio(portfolio)
                    .assetId(asset.getId())
                    .weight(assetDto.weight())
                    .aiNote(assetDto.aiNote())
                    .createdAt(now)
                    .updatedAt(now)
                    .build());
        }
        fundPositionRepository.saveAll(rows);
    }

    private FundModelProposalDto toProposalDto(FundPortfolio portfolio) {
        List<FundPosition> positions =
                fundPositionRepository.findAllByFundPortfolioIdOrderByWeightDesc(portfolio.getId());
        Map<Long, String> codesById = assetRepository
                .findAllById(positions.stream().map(FundPosition::getAssetId).toList())
                .stream()
                .collect(java.util.stream.Collectors.toMap(Asset::getId, Asset::getAssetCode));

        List<FundModelAssetDto> assets = positions.stream()
                .map(position -> new FundModelAssetDto(
                        codesById.get(position.getAssetId()),
                        position.getWeight(),
                        position.getAiNote()
                ))
                .toList();

        Integer rank = portfolio.getProposalRank() == null
                ? null
                : portfolio.getProposalRank().intValue();

        return new FundModelProposalDto(
                rank == null ? 0 : rank,
                portfolio.getLabel(),
                assets
        );
    }

    private Map<String, Asset> resolveAssets(List<String> codes) {
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String raw : codes) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String normalized = normalizeCode(raw);
            unique.putIfAbsent(normalized, normalized);
        }
        if (unique.isEmpty()) {
            return Map.of();
        }

        Map<String, Asset> byCode = new HashMap<>();
        for (String code : unique.keySet()) {
            assetRepository.findByAssetCode(code).ifPresent(asset -> byCode.put(code, asset));
        }
        if (byCode.size() != unique.size()) {
            throw new BaseException(ErrorCode.FUND_WORKING_PORTFOLIO_INVALID);
        }
        return byCode;
    }

    private void deletePortfolioWithPositions(FundPortfolio portfolio) {
        fundPositionRepository.deleteAllByFundPortfolioId(portfolio.getId());
        fundPositionRepository.flush();
        fundPortfolioRepository.delete(portfolio);
        fundPortfolioRepository.flush();
    }

    private static String normalizeCode(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }
}
