package com.infina.portfoliomanagement.marketdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "equity_prices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EquityPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Column(name = "data_date", nullable = false)
    private LocalDate dataDate;

    @Column(name = "open_price", precision = 19, scale = 6)
    private BigDecimal openPrice;

    @Column(name = "high_price", precision = 19, scale = 6)
    private BigDecimal highPrice;

    @Column(name = "low_price", precision = 19, scale = 6)
    private BigDecimal lowPrice;

    @Column(name = "close_price", nullable = false, precision = 19, scale = 6)
    private BigDecimal closePrice;

    @Column(name = "source_record_date")
    private LocalDateTime sourceRecordDate;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
