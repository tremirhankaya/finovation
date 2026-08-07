package com.infina.portfoliomanagement.company.policy;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.user.enums.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class CompanyManagementPolicy {

    public void assertCanManageCompanies(Role actorRole) {
        if (actorRole == Role.SUPER_ADMIN) {
            return;
        }

        log.debug("Company management access denied for role {}", actorRole);
        throw new BaseException(ErrorCode.ACCESS_DENIED);
    }
}
