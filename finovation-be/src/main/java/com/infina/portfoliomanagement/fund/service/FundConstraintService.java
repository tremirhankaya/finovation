package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.entity.FundConstraint;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.enums.ConstraintCode;
import com.infina.portfoliomanagement.fund.enums.ConstraintSource;
import com.infina.portfoliomanagement.fund.repository.FundConstraintRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;


@Service
@RequiredArgsConstructor
public class FundConstraintService {

    private final FundConstraintRepository fundConstraintRepository;

    public void saveProfileConstraints(FundDraft draft, FundProperties limits, LocalDateTime now) {
        fundConstraintRepository.saveAll(profileConstraints(draft, limits, now));
    }

    public void replacePortfolioRuleConstraints(
            FundDraft draft,
            FundProperties limits,
            int minStockCount,
            int maxStockCount,
            LocalDateTime now
    ) {
        fundConstraintRepository.deleteAllByFundDraft_Id(draft.getId());
        fundConstraintRepository.flush();

        List<FundConstraint> rows = new ArrayList<>(profileConstraints(draft, limits, now));
        rows.add(constraint(
                draft,
                ConstraintCode.MIN_STOCK_COUNT,
                BigDecimal.valueOf(minStockCount),
                ConstraintSource.USER,
                now
        ));
        rows.add(constraint(
                draft,
                ConstraintCode.MAX_STOCK_COUNT,
                BigDecimal.valueOf(maxStockCount),
                ConstraintSource.USER,
                now
        ));
        fundConstraintRepository.saveAll(rows);
    }

    private static List<FundConstraint> profileConstraints(
            FundDraft draft,
            FundProperties limits,
            LocalDateTime now
    ) {
        return List.of(
                constraint(
                        draft,
                        ConstraintCode.EQUITY_MIN,
                        BigDecimal.valueOf(limits.minEquityWeightPct()),
                        ConstraintSource.PROFILE,
                        now
                ),
                constraint(
                        draft,
                        ConstraintCode.EQUITY_MAX,
                        BigDecimal.valueOf(limits.maxEquityWeightPct()),
                        ConstraintSource.PROFILE,
                        now
                ),
                constraint(
                        draft,
                        ConstraintCode.SINGLE_STOCK_MAX,
                        BigDecimal.valueOf(limits.maxSingleStockMaxPct()),
                        ConstraintSource.PROFILE,
                        now
                ),
                constraint(
                        draft,
                        ConstraintCode.SECTOR_MAX,
                        limits.sectorMaxPct(),
                        ConstraintSource.PROFILE,
                        now
                )
        );
    }

    private static FundConstraint constraint(
            FundDraft draft,
            ConstraintCode code,
            BigDecimal value,
            ConstraintSource source,
            LocalDateTime now
    ) {
        return FundConstraint.builder()
                .fundDraft(draft)
                .constraintCode(code)
                .constraintValue(value)
                .source(source)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
