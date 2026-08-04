package com.infina.portfoliomanagement.marketdata.service.sector;

import com.infina.portfoliomanagement.marketdata.entity.Sector;
import com.infina.portfoliomanagement.marketdata.infina.api.SectorApi;
import com.infina.portfoliomanagement.marketdata.infina.dto.SectorRecord;
import com.infina.portfoliomanagement.marketdata.repository.SectorRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class SectorSyncService {

    private final SectorApi sectorApi;
    private final SectorRepository sectorRepository;
    private final Clock clock;

    public SectorSyncService(SectorApi sectorApi, SectorRepository sectorRepository, Clock clock) {
        this.sectorApi = sectorApi;
        this.sectorRepository = sectorRepository;
        this.clock = clock;
    }

    @Transactional
    public void sync() {
        List<SectorRecord> fetched = sectorApi.fetchAll();
        LocalDateTime now = LocalDateTime.now(clock);

        int created = 0;
        int updated = 0;

        for (SectorRecord record : fetched) {
            Sector sector = sectorRepository.findBySectorCode(record.code()).orElse(null);

            if (sector == null) {
                sector = Sector.builder()
                        .sectorCode(record.code())
                        .name(record.name())
                        .createdAt(now)
                        .updatedAt(now)
                        .build();
                created++;
            } else {
                sector.setName(record.name());
                sector.setUpdatedAt(now);
                updated++;
            }

            sectorRepository.save(sector);
        }

        log.info("sector sync finished: {} fetched, {} created, {} updated", fetched.size(), created, updated);
    }
}
