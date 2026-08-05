package com.infina.portfoliomanagement.marketdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "equity_details")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EquityDetail {

    @Id
    @Column(name = "asset_id")
    private Long assetId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "asset_id")
    private Asset asset;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sector_id")
    private Sector sector;

    @Column(name = "company_name", nullable = false, length = 200)
    private String companyName;

    @Column(name = "security_type", length = 30)
    private String securityType;

    @Column(name = "vendor_code", length = 30)
    private String vendorCode;

    @Column(name = "issuer_code", length = 20)
    private String issuerCode;

    @Column(name = "isin_code", length = 12)
    private String isinCode;

    @Column(name = "legacy_code", length = 60)
    private String legacyCode;

    @Column(name = "market_code", length = 20)
    private String marketCode;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
