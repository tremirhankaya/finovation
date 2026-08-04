package com.infina.portfoliomanagement.fund.entity;

import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "fund_portfolios")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FundPortfolio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, updatable = false)
    private UUID publicId;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fund_draft_id", nullable = false)
    private FundDraft fundDraft;

    @Column(name = "model_run_id")
    private Long modelRunId;

    @Enumerated(EnumType.STRING)
    @Column(name = "portfolio_type", nullable = false, length = 20)
    private PortfolioType portfolioType;

    @Column(name = "proposal_rank")
    private Short proposalRank;

    @Column(name = "is_selected", nullable = false)
    private boolean selected;

    @Column(name = "label", length = 100)
    private String label;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
