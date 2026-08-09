package com.infina.portfoliomanagement.fund.entity;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "fund_positions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FundPosition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fund_portfolio_id", nullable = false)
    private FundPortfolio fundPortfolio;

    @Column(name = "asset_id", nullable = false)
    private Long assetId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", insertable = false, updatable = false)
    private Asset asset;

    @Column(name = "weight", nullable = false, precision = 9, scale = 6)
    private BigDecimal weight;

    @Column(name = "ai_note", length = 200)
    private String aiNote;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
