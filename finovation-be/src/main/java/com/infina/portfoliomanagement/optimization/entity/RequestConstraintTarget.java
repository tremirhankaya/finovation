package com.infina.portfoliomanagement.optimization.entity;

import com.infina.portfoliomanagement.optimization.enums.OptimizationConstraintCode;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "optimization_request_constraint_targets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RequestConstraintTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    private OptimizationRequest request;

    @Enumerated(EnumType.STRING)
    @Column(name = "constraint_code", nullable = false, length = 30)
    private OptimizationConstraintCode constraintCode;

    @Column(name = "min_value", precision = 18, scale = 6)
    private BigDecimal minValue;

    @Column(name = "max_value", precision = 18, scale = 6)
    private BigDecimal maxValue;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
