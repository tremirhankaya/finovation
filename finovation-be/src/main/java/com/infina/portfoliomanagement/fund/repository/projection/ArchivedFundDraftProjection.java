package com.infina.portfoliomanagement.fund.repository.projection;

import java.time.LocalDateTime;

public interface ArchivedFundDraftProjection {

    String getPublicId();

    String getName();

    String getStatus();

    LocalDateTime getArchivedAt();
}
