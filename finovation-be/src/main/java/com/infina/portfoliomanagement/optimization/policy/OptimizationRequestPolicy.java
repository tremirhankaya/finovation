package com.infina.portfoliomanagement.optimization.policy;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.optimization.entity.OptimizationRequest;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OptimizationRequestPolicy {

    public void assertCanAccess(User actor, OptimizationRequest request) {
        if (actor.getRole() == Role.SUPER_ADMIN) {
            return;
        }

        Long ownerId = request.getRequestedBy() != null
                ? request.getRequestedBy().getId()
                : null;

        if (ownerId == null || !ownerId.equals(actor.getId())) {
            log.debug(
                    "Optimization request access denied for actor {}: requestId={}, ownerId={}",
                    actor.getId(),
                    request.getId(),
                    ownerId
            );
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
    }
}
