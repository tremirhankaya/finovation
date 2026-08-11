package com.infina.portfoliomanagement.fundmonitoring.entity;

import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fundmonitoring.enums.FundRebalanceType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "fund_rebalances")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FundRebalance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "fund_draft_id", nullable = false)
    private FundDraft fundDraft;

    @Enumerated(EnumType.STRING)
    @Column(name = "rebalance_type", nullable = false, length = 20)
    private FundRebalanceType rebalanceType;

    @Column(name = "effective_at", nullable = false)
    private LocalDateTime effectiveAt;

    @Column(name = "optimization_request_id")
    private Long optimizationRequestId;

    @Column(name = "nav_at_rebalance", nullable = false, precision = 28, scale = 8)
    private BigDecimal navAtRebalance;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "fundRebalance", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<FundRebalancePosition> positions = new ArrayList<>();

    public void addPosition(FundRebalancePosition position) {
        positions.add(position);
        position.setFundRebalance(this);
    }
}
