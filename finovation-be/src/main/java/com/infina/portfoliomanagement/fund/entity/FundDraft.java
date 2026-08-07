package com.infina.portfoliomanagement.fund.entity;

import com.infina.portfoliomanagement.fund.enums.FundCurrency;
import com.infina.portfoliomanagement.fund.enums.FundDesignSteps;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.enums.InvestmentHorizon;
import com.infina.portfoliomanagement.fund.enums.ManagementApproach;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "fund_drafts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FundDraft {

    public static final String DEFAULT_CURRENCY_CODE = FundCurrency.TRY.getCode();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, updatable = false)
    private UUID publicId;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "name", length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "fund_type", nullable = false, length = 30)
    private FundType fundType;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(name = "initial_portfolio_size", nullable = false, precision = 18, scale = 2)
    private BigDecimal initialPortfolioSize;

    @Column(name = "unit_price", precision = 18, scale = 4)
    private BigDecimal unitPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "management_approach", length = 20)
    private ManagementApproach managementApproach;

    @Column(name = "liquidity_target_pct")
    private Short liquidityTargetPct;

    @Column(name = "horizon", length = 5)
    private InvestmentHorizon horizon;

    @Column(name = "tpp_min_pct")
    private Short tppMinPct;

    @Column(name = "tpp_max_pct")
    private Short tppMaxPct;

    @Column(name = "preferred_tpp_pct")
    private Short preferredTppPct;

    @Column(name = "min_stock_count")
    private Short minStockCount;

    @Column(name = "max_stock_count")
    private Short maxStockCount;

    @Column(name = "equity_min_pct")
    private Short equityMinPct;

    @Column(name = "equity_max_pct")
    private Short equityMaxPct;

    @Column(name = "single_stock_max_pct")
    private Short singleStockMaxPct;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private FundDraftStatus status;

    @Column(name = "current_step", nullable = false)
    private Short currentStep;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static FundDraft newDraft(
            String name,
            BigDecimal initialPortfolioSize,
            BigDecimal unitPrice,
            Long createdByUserId,
            LocalDateTime now
    ) {
        return FundDraft.builder()
                .publicId(UUID.randomUUID())
                .name(name)
                .fundType(FundType.EQUITY_INTENSIVE)
                .currencyCode(DEFAULT_CURRENCY_CODE)
                .initialPortfolioSize(initialPortfolioSize)
                .unitPrice(unitPrice)
                .status(FundDraftStatus.IN_PROGRESS)
                .currentStep((short) FundDesignSteps.STRATEGY)
                .createdByUserId(createdByUserId)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
