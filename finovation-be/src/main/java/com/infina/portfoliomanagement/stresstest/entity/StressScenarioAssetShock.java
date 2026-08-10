package com.infina.portfoliomanagement.stresstest.entity;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "stress_scenario_asset_shocks",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_stress_scenario_asset_shocks_scenario_asset",
                columnNames = {"scenario_id", "asset_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StressScenarioAssetShock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id", nullable = false)
    private StressScenario scenario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Column(name = "impact", nullable = false, precision = 20, scale = 12)
    private BigDecimal impact;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}