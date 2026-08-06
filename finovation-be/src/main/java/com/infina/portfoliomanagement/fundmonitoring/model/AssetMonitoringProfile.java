package com.infina.portfoliomanagement.fundmonitoring.model;

public record AssetMonitoringProfile(
        Long assetId,
        String symbol,
        String displayName,
        String allocationGroupId,
        String allocationGroupName,
        boolean liquid
) {
}
