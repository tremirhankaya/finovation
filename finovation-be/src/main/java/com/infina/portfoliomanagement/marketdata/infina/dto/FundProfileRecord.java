package com.infina.portfoliomanagement.marketdata.infina.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FundProfileRecord(
        @JsonProperty("Periods") List<String> periods,
        @JsonProperty("Benchmarks") List<FundBenchmarkRecord> benchmarks
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FundBenchmarkRecord(
            String code,
            String description,
            String type,
            @JsonProperty("BmReturn") List<BigDecimal> returns
    ) {
    }
}
