package com.infina.portfoliomanagement.fund.entity;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Column;
import jakarta.persistence.Table;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "fund_asset_exclusions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FundAssetExclusion {

    @EmbeddedId
    private FundAssetExclusionId id;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
