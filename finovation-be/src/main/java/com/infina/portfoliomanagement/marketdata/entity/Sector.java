package com.infina.portfoliomanagement.marketdata.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "sectors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sector {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sector_code", nullable = false, unique = true, length = 20)
    private String sectorCode;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
