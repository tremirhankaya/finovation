package com.infina.portfoliomanagement.user.policy;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.user.enums.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class UserCompanyPolicy {

    public void assertCanManageTarget(
            Role actorRole,
            Long actorCompanyId,
            Long targetCompanyId
    ) {
        if (actorRole != Role.ADMIN) {
            return;
        }

        if (actorCompanyId == null
                || !actorCompanyId.equals(targetCompanyId)) {
            log.debug(
                    "Company scope denied for role {}: actorCompanyId={}, targetCompanyId={}",
                    actorRole,
                    actorCompanyId,
                    targetCompanyId
            );
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
    }

    public void assertCanAssignCompany(
            Role actorRole,
            Long actorCompanyId,
            Long requestedCompanyId
    ) {
        if (requestedCompanyId == null) {
            return;
        }

        if (actorRole == Role.ADMIN
                && (actorCompanyId == null || !actorCompanyId.equals(requestedCompanyId))) {
            log.debug(
                    "Company assignment denied for role {}: actorCompanyId={}, requestedCompanyId={}",
                    actorRole,
                    actorCompanyId,
                    requestedCompanyId
            );
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
    }

    public void assertCanQueryCompany(
            Role actorRole,
            Long actorCompanyId,
            Long requestedCompanyId
    ) {
        if (requestedCompanyId == null) {
            return;
        }

        if (actorCompanyId == null || !actorCompanyId.equals(requestedCompanyId)) {
            log.debug(
                    "Company query denied for role {}: actorCompanyId={}, requestedCompanyId={}",
                    actorRole,
                    actorCompanyId,
                    requestedCompanyId
            );
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
    }
}
