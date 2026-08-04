package com.infina.portfoliomanagement.marketdata.service.equity.price;

import com.infina.portfoliomanagement.marketdata.repository.EquityPriceRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityPriceRevisionRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class EquityPriceWriter {

    private final EquityPriceRepository equityPriceRepository;
    private final EquityPriceRevisionRepository equityPriceRevisionRepository;

    public EquityPriceWriter(EquityPriceRepository equityPriceRepository,
                             EquityPriceRevisionRepository equityPriceRevisionRepository) {
        this.equityPriceRepository = equityPriceRepository;
        this.equityPriceRevisionRepository = equityPriceRevisionRepository;
    }

    @Transactional
    public void write(PriceChanges changes) {
        equityPriceRevisionRepository.saveAll(changes.revisions());
        equityPriceRepository.saveAll(changes.newPrices());
        equityPriceRepository.saveAll(changes.updatedPrices());
    }
}
