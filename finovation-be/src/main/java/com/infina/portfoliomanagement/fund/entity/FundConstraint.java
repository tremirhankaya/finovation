package com.infina.portfoliomanagement.fund.entity;

import com.infina.portfoliomanagement.fund.enums.ConstraintCode;
import com.infina.portfoliomanagement.fund.enums.ConstraintSource;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "fund_constraints")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FundConstraint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fund_draft_id", nullable = false)
    private FundDraft fundDraft;

    @Enumerated(EnumType.STRING)
    @Column(name = "constraint_code", nullable = false, length = 40)
    private ConstraintCode constraintCode;

    @Column(name = "constraint_value", nullable = false, precision = 9, scale = 4)
    private BigDecimal constraintValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 10)
    private ConstraintSource source;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
