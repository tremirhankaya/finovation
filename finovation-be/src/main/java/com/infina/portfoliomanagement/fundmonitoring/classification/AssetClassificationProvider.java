package com.infina.portfoliomanagement.fundmonitoring.classification;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.fundmonitoring.model.AssetMonitoringProfile;
import com.infina.portfoliomanagement.marketdata.entity.Asset;

import java.util.List;
import java.util.Map;

public interface AssetClassificationProvider {

    AssetType supportedType();

    Map<Long, AssetMonitoringProfile> loadProfiles(List<Asset> assets);
}
