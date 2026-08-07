package com.infina.portfoliomanagement.stresstest.entity;

import com.infina.portfoliomanagement.common.enums.AssetType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
@Entity
@Table(name = "stress_test_position_snapshots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StressTestPositionSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;


    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stress_test_id", nullable = false)
    private StressTest stressTest;

    @Column(name = "asset_id", nullable = false)
    private Long assetId;

    @Column(name = "asset_code", nullable = false, length = 50)
    private String assetCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_type", nullable = false, length = 30)
    private AssetType assetType;

    @Column(name = "weight", nullable = false, precision = 18, scale = 8)
    private BigDecimal weight;

    @Column(name = "impact", precision = 18, scale = 8)
    private BigDecimal impact;

    @Column(name = "portfolio_contribution", precision = 18, scale = 8)
    private BigDecimal portfolioContribution;
}