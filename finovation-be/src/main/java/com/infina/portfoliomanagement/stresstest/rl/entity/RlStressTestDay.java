package com.infina.portfoliomanagement.stresstest.rl.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "rl_stress_test_days")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RlStressTestDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rl_stress_test_id", nullable = false)
    private RlStressTest stressTest;

    @Column(name = "day_number", nullable = false)
    private Integer dayNumber;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "total_new_nav", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalNewNav;

    @Column(name = "passive_nav", nullable = false, precision = 19, scale = 4)
    private BigDecimal passiveNav;
}