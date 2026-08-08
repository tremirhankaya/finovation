package com.infina.portfoliomanagement.fund.entity;

import com.infina.portfoliomanagement.fund.enums.FundType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "fund_design_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FundDesignProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "fund_type", nullable = false, length = 30)
    private FundType fundType;

    @Column(name = "min_initial_portfolio_size", nullable = false, precision = 18, scale = 2)
    private BigDecimal minInitialPortfolioSize;

    @Column(name = "max_initial_portfolio_size", nullable = false, precision = 18, scale = 2)
    private BigDecimal maxInitialPortfolioSize;

    @Column(name = "min_unit_price", nullable = false, precision = 18, scale = 4)
    private BigDecimal minUnitPrice;

    @Column(name = "max_unit_price", nullable = false, precision = 18, scale = 4)
    private BigDecimal maxUnitPrice;

    @Column(name = "min_liquidity_target_pct", nullable = false)
    private Short minLiquidityTargetPct;

    @Column(name = "max_liquidity_target_pct", nullable = false)
    private Short maxLiquidityTargetPct;

    @Column(name = "min_stock_count", nullable = false)
    private Short minStockCount;

    @Column(name = "max_stock_count", nullable = false)
    private Short maxStockCount;

    @Column(name = "min_single_stock_max_pct", nullable = false)
    private Short minSingleStockMaxPct;

    @Column(name = "max_single_stock_max_pct", nullable = false)
    private Short maxSingleStockMaxPct;

    @Column(name = "min_equity_weight_pct", nullable = false)
    private Short minEquityWeightPct;

    @Column(name = "max_equity_weight_pct", nullable = false)
    private Short maxEquityWeightPct;

    @Column(name = "sector_max_pct", nullable = false, precision = 9, scale = 4)
    private BigDecimal sectorMaxPct;

    @Column(name = "min_tpp_range_pct", nullable = false)
    private Short minTppRangePct;

    @Column(name = "min_stock_count_range", nullable = false)
    private Short minStockCountRange;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
