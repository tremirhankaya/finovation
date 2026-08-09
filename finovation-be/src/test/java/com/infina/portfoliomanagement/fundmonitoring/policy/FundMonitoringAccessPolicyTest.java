package com.infina.portfoliomanagement.fundmonitoring.policy;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FundMonitoringAccessPolicyTest {

    private final FundMonitoringAccessPolicy policy =
            new FundMonitoringAccessPolicy();

    @Test
    void companyManager_canViewUserFundsInSameCompany() {
        Company company = Company.builder().id(5L).build();
        User actor = User.builder()
                .role(Role.COMPANY_MANAGER)
                .company(company)
                .build();
        User owner = User.builder()
                .role(Role.USER)
                .company(company)
                .build();

        assertThatCode(() -> policy.assertCanViewUserFunds(actor, owner))
                .doesNotThrowAnyException();
    }

    @Test
    void companyManager_cannotViewFundsOutsideCompany() {
        User actor = User.builder()
                .role(Role.COMPANY_MANAGER)
                .company(Company.builder().id(5L).build())
                .build();
        User owner = User.builder()
                .role(Role.USER)
                .company(Company.builder().id(6L).build())
                .build();

        assertThatThrownBy(() -> policy.assertCanViewUserFunds(actor, owner))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }
}
