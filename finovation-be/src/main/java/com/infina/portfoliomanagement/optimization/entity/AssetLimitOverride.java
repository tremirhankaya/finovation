package com.infina.portfoliomanagement.optimization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "optimization_asset_limit_overrides")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetLimitOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    private OptimizationRequest request;

    @Column(name = "asset_code", nullable = false, length = 20)
    private String assetCode;

    @Column(name = "min_weight", precision = 18, scale = 6)
    private BigDecimal minWeight;

    @Column(name = "max_weight", precision = 18, scale = 6)
    private BigDecimal maxWeight;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
