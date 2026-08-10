package com.infina.portfoliomanagement.optimization.entity;

import com.infina.portfoliomanagement.optimization.enums.RequestStatus;
import com.infina.portfoliomanagement.optimization.enums.RiskProfile;
import com.infina.portfoliomanagement.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "optimization_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OptimizationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fund_id", nullable = false)
    private UUID fundId;

    @Column(name = "data_timestamp")
    private LocalDateTime dataTimestamp;

    @Column(name = "model_version", length = 50)
    private String modelVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id", nullable = false)
    private User requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by_user_id")
    private User decidedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_profile", nullable = false, length = 15)
    private RiskProfile riskProfile;

    @Column(name = "max_additions", nullable = false)
    private Integer maxAdditions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RequestStatus status;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
