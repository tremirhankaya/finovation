package com.infina.portfoliomanagement.marketdata.repository;

import com.infina.portfoliomanagement.marketdata.entity.Sector;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SectorRepository extends JpaRepository<Sector, Long> {

    Optional<Sector> findBySectorCode(String sectorCode);
}
