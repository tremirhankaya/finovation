package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.repository.FundDesignProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FundDesignProfileService {

    private final FundDesignProfileRepository fundDesignProfileRepository;

    @Transactional(readOnly = true)
    public FundProperties getLimits(FundType fundType) {
        return fundDesignProfileRepository.findByFundType(fundType)
                .map(FundProperties::from)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_DESIGN_PROFILE_NOT_FOUND));
    }
}
