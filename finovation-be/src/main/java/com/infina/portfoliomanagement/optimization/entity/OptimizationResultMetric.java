package com.infina.portfoliomanagement.optimization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "optimization_result_metrics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OptimizationResultMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "result_id", nullable = false)
    private OptimizationResult result;

    @Column(name = "metric_key", nullable = false, length = 30)
    private String metricKey;

    @Column(name = "current_value", precision = 18, scale = 6)
    private BigDecimal currentValue;

    @Column(name = "proposed_value", precision = 18, scale = 6)
    private BigDecimal proposedValue;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
