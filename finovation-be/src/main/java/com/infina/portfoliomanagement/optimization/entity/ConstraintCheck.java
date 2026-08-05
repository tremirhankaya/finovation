package com.infina.portfoliomanagement.optimization.entity;

import com.infina.portfoliomanagement.optimization.enums.CheckStatus;
import com.infina.portfoliomanagement.optimization.enums.OptimizationConstraintCode;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "optimization_constraint_checks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConstraintCheck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    private OptimizationRequest request;

    @Enumerated(EnumType.STRING)
    @Column(name = "constraint_code", nullable = false, length = 30)
    private OptimizationConstraintCode constraintCode;

    @Column(name = "actual_value", nullable = false, precision = 18, scale = 6)
    private BigDecimal actualValue;

    @Column(name = "min_limit", precision = 18, scale = 6)
    private BigDecimal minLimit;

    @Column(name = "max_limit", precision = 18, scale = 6)
    private BigDecimal maxLimit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CheckStatus status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
