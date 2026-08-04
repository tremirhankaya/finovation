package com.infina.portfoliomanagement.fund.entity;

import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
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

    @Enumerated(EnumType.STRING)
    @Column(name = "management_approach", length = 20)
    private ManagementApproach managementApproach;

    @Column(name = "liquidity_target_pct")
    private Short liquidityTargetPct;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private FundDraftStatus status;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
