package com.infina.portfoliomanagement.fund.repository.projection;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public interface ArchivedFundDraftProjection {

    String getPublicId();

    String getName();

    String getStatus();

    LocalDateTime getArchivedAt();

    BigDecimal getInitialPortfolioSize();

    BigDecimal getUnitPrice();

    String getDeletedBy();
}
