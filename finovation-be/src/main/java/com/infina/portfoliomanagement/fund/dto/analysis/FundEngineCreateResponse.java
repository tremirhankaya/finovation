package com.infina.portfoliomanagement.fund.dto.analysis;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FundEngineCreateResponse(
        @JsonProperty("request_id") String requestId,
        @JsonProperty("snapshot_id") String snapshotId,
        @JsonProperty("system_date") String systemDate,
        @JsonProperty("alternatives") List<FundEngineAlternativeDto> alternatives
) {}
