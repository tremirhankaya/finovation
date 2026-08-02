package com.infina.portfoliomanagement.marketdata.ingest.tatilgunleri.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDate;

public record HolidayRecord(
        @JsonProperty("data_date") LocalDate dataDate,
        @JsonProperty("tarih") LocalDate date,
        @JsonProperty("aciklama") String description,
        @JsonProperty("yarim_gun") Boolean halfDay,
        @JsonProperty("yil") Integer year
) {
}
