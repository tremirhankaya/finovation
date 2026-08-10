package com.infina.portfoliomanagement.stresstest.entity;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(
        name = "stress_scenario_asset_paths",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_stress_scenario_asset_paths_scenario_asset_day",
                columnNames = {"scenario_id", "asset_id", "day_index"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StressScenarioAssetPath {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id", nullable = false)
    private StressScenario scenario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Column(name = "path_date", nullable = false)
    private LocalDate pathDate;

    @Column(name = "day_index", nullable = false)
    private Short dayIndex;

    @Column(name = "close_value", nullable = false, precision = 20, scale = 8)
    private BigDecimal closeValue;

    @Column(name = "impact", nullable = false, precision = 20, scale = 12)
    private BigDecimal impact;
}