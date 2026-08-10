package com.infina.portfoliomanagement.stresstest.rl.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "rl_stress_test_day_weights")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RlStressTestDayWeight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rl_stress_test_day_id", nullable = false)
    private RlStressTestDay day;

    @Column(name = "asset_code", nullable = false, length = 50)
    private String assetCode;

    @Column(name = "weight", nullable = false, precision = 18, scale = 12)
    private BigDecimal weight;
}