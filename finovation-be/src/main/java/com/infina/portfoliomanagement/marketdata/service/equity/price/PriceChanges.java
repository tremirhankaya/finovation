package com.infina.portfoliomanagement.marketdata.service.equity.price;

import com.infina.portfoliomanagement.marketdata.entity.EquityPrice;
import com.infina.portfoliomanagement.marketdata.entity.EquityPriceRevision;

import java.util.List;

record PriceChanges(List<EquityPrice> newPrices,
                           List<EquityPrice> updatedPrices,
                           List<EquityPriceRevision> revisions) {

    static PriceChanges none() {
        return new PriceChanges(List.of(), List.of(), List.of());
    }

    boolean isEmpty() {
        return newPrices.isEmpty() && updatedPrices.isEmpty() && revisions.isEmpty();
    }

    int insertedCount() {
        return newPrices.size();
    }

    int updatedCount() {
        return updatedPrices.size();
    }
}
