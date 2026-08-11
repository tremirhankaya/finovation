package com.infina.portfoliomanagement.fundmonitoring.entity;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "fund_rebalance_positions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FundRebalancePosition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fund_rebalance_id", nullable = false)
    private FundRebalance fundRebalance;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Column(name = "target_weight", nullable = false, precision = 9, scale = 6)
    private BigDecimal targetWeight;

    @Column(name = "quantity", nullable = false, precision = 28, scale = 12)
    private BigDecimal quantity;

    @Column(name = "execution_price", nullable = false, precision = 28, scale = 8)
    private BigDecimal executionPrice;
}
