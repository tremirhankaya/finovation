package com.infina.portfoliomanagement.fund.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode
public class FundAssetExclusionId implements Serializable {

    @Column(name = "fund_draft_id", nullable = false)
    private Long fundDraftId;

    @Column(name = "asset_id", nullable = false)
    private Long assetId;
}
