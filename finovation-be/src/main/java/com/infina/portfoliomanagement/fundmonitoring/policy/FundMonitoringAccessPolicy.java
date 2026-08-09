package com.infina.portfoliomanagement.fundmonitoring.policy;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public class FundMonitoringAccessPolicy {

    public void assertCanView(FundDraft fund, Long actorUserId) {
        if (Objects.equals(fund.getCreatedByUserId(), actorUserId)) {
            return;
        }

        throw new BaseException(ErrorCode.FUND_NOT_FOUND);
    }

    public void assertCanViewUserFunds(User actor, User owner) {
        Long actorCompanyId = actor.getCompany() != null
                ? actor.getCompany().getId()
                : null;
        Long ownerCompanyId = owner.getCompany() != null
                ? owner.getCompany().getId()
                : null;

        if (actor.getRole() == Role.COMPANY_MANAGER
                && owner.getRole() == Role.USER
                && actorCompanyId != null
                && actorCompanyId.equals(ownerCompanyId)) {
            return;
        }

        throw new BaseException(ErrorCode.ACCESS_DENIED);
    }
}
