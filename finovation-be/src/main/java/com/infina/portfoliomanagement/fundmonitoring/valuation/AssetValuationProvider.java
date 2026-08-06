package com.infina.portfoliomanagement.fundmonitoring.valuation;

import com.infina.portfoliomanagement.common.enums.AssetType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;

public interface AssetValuationProvider {

    AssetType supportedType();

    Map<Long, NavigableMap<LocalDate, BigDecimal>> loadUnitValues(
            List<Long> assetIds,
            LocalDate from,
            LocalDate to
    );
}
