package com.infina.portfoliomanagement.optimization.entity;

import com.infina.portfoliomanagement.optimization.enums.AssetPreferenceType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "optimization_asset_preferences")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    private OptimizationRequest request;

    @Column(name = "asset_code", nullable = false, length = 20)
    private String assetCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "preference_type", nullable = false, length = 20)
    private AssetPreferenceType preferenceType;

    @Column(name = "current_weight", precision = 18, scale = 6)
    private BigDecimal currentWeight;

    @Column(name = "fixed_weight", precision = 18, scale = 6)
    private BigDecimal fixedWeight;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
