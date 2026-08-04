package com.infina.portfoliomanagement.marketdata.infina.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDate;

public record SectorRecord(
        String code,
        String name,
        @JsonProperty("last_update_time") LocalDate lastUpdateTime
) {
}
