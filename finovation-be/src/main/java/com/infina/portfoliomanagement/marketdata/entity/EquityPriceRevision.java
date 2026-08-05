package com.infina.portfoliomanagement.marketdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "equity_price_revisions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EquityPriceRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id", nullable = false)
    private Asset asset;

    @Column(name = "data_date", nullable = false)
    private LocalDate dataDate;

    @Column(name = "old_close_price", nullable = false, precision = 19, scale = 8)
    private BigDecimal oldClosePrice;

    @Column(name = "new_close_price", nullable = false, precision = 19, scale = 8)
    private BigDecimal newClosePrice;

    @Column(name = "old_source_record_date")
    private LocalDateTime oldSourceRecordDate;

    @Column(name = "new_source_record_date")
    private LocalDateTime newSourceRecordDate;

    @Column(name = "detected_at", nullable = false)
    private LocalDateTime detectedAt;
}
