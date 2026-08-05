package com.infina.portfoliomanagement.marketdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tpp_rates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TppRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Column(name = "data_date", nullable = false)
    private LocalDate dataDate;

    @Column(name = "maturity_date")
    private LocalDate maturityDate;

    @Column(name = "open_rate", precision = 9, scale = 4)
    private BigDecimal openRate;

    @Column(name = "high_rate", precision = 9, scale = 4)
    private BigDecimal highRate;

    @Column(name = "low_rate", precision = 9, scale = 4)
    private BigDecimal lowRate;

    @Column(name = "close_rate", precision = 9, scale = 4)
    private BigDecimal closeRate;

    @Column(name = "weighted_average_rate", nullable = false, precision = 9, scale = 4)
    private BigDecimal weightedAverageRate;

    @Column(name = "trading_volume", precision = 19, scale = 2)
    private BigDecimal tradingVolume;

    @Column(name = "transaction_count")
    private Integer transactionCount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
