package com.infina.portfoliomanagement.optimization.entity;

import com.infina.portfoliomanagement.optimization.enums.AssetType;
import com.infina.portfoliomanagement.optimization.enums.ResultActionType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "optimization_result_assets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OptimizationResultAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "result_id", nullable = false)
    private OptimizationResult result;

    @Column(name = "asset_code", nullable = false, length = 20)
    private String assetCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_type", nullable = false, length = 10)
    private AssetType assetType;

    @Column(name = "current_weight", nullable = false, precision = 18, scale = 6)
    private BigDecimal currentWeight;

    @Column(name = "proposed_weight", nullable = false, precision = 18, scale = 6)
    private BigDecimal proposedWeight;

    @Column(name = "final_weight", precision = 18, scale = 6)
    private BigDecimal finalWeight;

    @Column(name = "change_amount", nullable = false, precision = 18, scale = 6)
    private BigDecimal changeAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 20)
    private ResultActionType actionType;

    @Column(name = "manually_overridden", nullable = false)
    private boolean manuallyOverridden;

    @Column(length = 1000)
    private String rationale;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
