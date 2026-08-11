package com.infina.portfoliomanagement.stresstest.rl.entity;

import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "rl_stress_tests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RlStressTest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    private UUID publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fund_portfolio_id", nullable = false)
    private FundPortfolio fundPortfolio;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "model", nullable = false, length = 100)
    private String model;

    @Column(name = "scenario_code", nullable = false, length = 100)
    private String scenarioCode;

    @Column(name = "scenario_start_date")
    private LocalDate scenarioStartDate;

    @Column(name = "scenario_end_date")
    private LocalDate scenarioEndDate;

    @Column(name = "trading_day_count")
    private Integer tradingDayCount;

    @Column(name = "initial_nav", nullable = false, precision = 19, scale = 4)
    private BigDecimal initialNav;

    @Column(name = "final_nav", precision = 19, scale = 4)
    private BigDecimal finalNav;

    @Column(name = "return_pct", precision = 18, scale = 8)
    private BigDecimal returnPct;

    @Column(name = "passive_final_nav", precision = 19, scale = 4)
    private BigDecimal passiveFinalNav;

    @Column(name = "passive_return_pct", precision = 18, scale = 8)
    private BigDecimal passiveReturnPct;

    @Column(name = "outperformance_amount", precision = 19, scale = 4)
    private BigDecimal outperformanceAmount;

    @Column(name = "outperformance_pct", precision = 18, scale = 8)
    private BigDecimal outperformancePct;

    @Column(name = "total_commission", precision = 19, scale = 4)
    private BigDecimal totalCommission;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}