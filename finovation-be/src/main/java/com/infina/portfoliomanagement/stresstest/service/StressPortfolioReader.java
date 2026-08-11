package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.enums.FundDesignMode;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioPosition;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.repository.StressPortfolioQueryRepository;
import com.infina.portfoliomanagement.stresstest.repository.projection.StressPortfolioPositionProjection;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StressPortfolioReader {

    private final StressPortfolioQueryRepository stressPortfolioQueryRepository;

    @Transactional(readOnly = true)
    public StressPortfolioSnapshot readSelectedPortfolio(
            Long userId,
            UUID fundPublicId
    ) {
        List<StressPortfolioPositionProjection> projections =
                stressPortfolioQueryRepository.findSelectedOrManualWorkingPortfolioPositions(
                        fundPublicId,
                        userId,
                        FundDesignMode.MANUAL,
                        PortfolioType.WORKING
                );

        if (projections.isEmpty()) {
            throw new BaseException(
                    ErrorCode.STRESS_PORTFOLIO_NOT_AVAILABLE
            );
        }

        Set<Long> portfolioIds = projections.stream()
                .map(StressPortfolioPositionProjection::getPortfolioId)
                .collect(Collectors.toSet());

        if (portfolioIds.size() != 1) {
            throw new BaseException(
                    ErrorCode.STRESS_PORTFOLIO_NOT_AVAILABLE
            );
        }

        List<StressPortfolioPosition> positions = projections.stream()
                .map(this::toPosition)
                .toList();

        return new StressPortfolioSnapshot(
                portfolioIds.iterator().next(),
                positions
        );
    }

    private StressPortfolioPosition toPosition(
            StressPortfolioPositionProjection projection
    ) {
        return new StressPortfolioPosition(
                projection.getAssetId(),
                projection.getAssetCode(),
                projection.getAssetType(),
                projection.getWeight()
        );
    }
}
