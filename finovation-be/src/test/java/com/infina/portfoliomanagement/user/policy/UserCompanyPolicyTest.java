package com.infina.portfoliomanagement.user.policy;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.user.enums.Role;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserCompanyPolicyTest {

    private final UserCompanyPolicy policy = new UserCompanyPolicy();

    @Test
    void queryCompany_nullFilter_isAllowed() {
        assertThatCode(() ->
                policy.assertCanQueryCompany(Role.COMPANY_MANAGER, 10L, null)
        ).doesNotThrowAnyException();
    }

    @Test
    void queryCompany_sameCompany_isAllowed() {
        assertThatCode(() ->
                policy.assertCanQueryCompany(Role.COMPANY_MANAGER, 10L, 10L)
        ).doesNotThrowAnyException();
    }

    @Test
    void queryCompany_otherCompany_isDenied() {
        assertThatThrownBy(() ->
                policy.assertCanQueryCompany(Role.COMPANY_MANAGER, 10L, 99L)
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    @Test
    void queryCompany_actorWithoutCompany_isDenied() {
        assertThatThrownBy(() ->
                policy.assertCanQueryCompany(Role.COMPANY_MANAGER, null, 10L)
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    @Test
    void manageTarget_adminInSameCompany_isAllowed() {
        assertThatCode(() ->
                policy.assertCanManageTarget(Role.COMPANY_MANAGER, 10L, 10L)
        ).doesNotThrowAnyException();
    }

    @Test
    void manageTarget_adminInOtherCompany_isDenied() {
        assertThatThrownBy(() ->
                policy.assertCanManageTarget(Role.COMPANY_MANAGER, 10L, 99L)
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    @Test
    void manageTarget_superAdmin_isNotCompanyScoped() {
        assertThatCode(() ->
                policy.assertCanManageTarget(Role.ADMIN, null, 99L)
        ).doesNotThrowAnyException();
    }
}
