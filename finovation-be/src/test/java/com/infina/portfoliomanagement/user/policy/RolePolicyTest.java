package com.infina.portfoliomanagement.user.policy;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.user.enums.Role;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

class RolePolicyTest {

    private final RolePolicy rolePolicy = new RolePolicy();

    @Test
    void superAdminCanAssignAdminAndSuperAdmin() {
        assertThat(rolePolicy.assignableRoles(Role.ADMIN))
                .containsExactlyInAnyOrder(Role.COMPANY_MANAGER, Role.ADMIN);
    }

    @Test
    void adminCanOnlyAssignUser() {
        assertThat(rolePolicy.assignableRoles(Role.COMPANY_MANAGER))
                .containsExactly(Role.USER);
    }

    @Test
    void userCannotAssignAnyRole() {
        assertThat(rolePolicy.assignableRoles(Role.USER)).isEmpty();
    }

    @Test
    void adminAndSuperAdminCanAccessPanel() {
        assertThat(rolePolicy.canAccessPanel(Role.COMPANY_MANAGER)).isTrue();
        assertThat(rolePolicy.canAccessPanel(Role.ADMIN)).isTrue();
        assertThat(rolePolicy.canCreateUser(Role.COMPANY_MANAGER)).isTrue();
        assertThat(rolePolicy.canDeleteUser(Role.COMPANY_MANAGER)).isTrue();
        assertThat(rolePolicy.canCreateUser(Role.ADMIN)).isTrue();
        assertThat(rolePolicy.canDeleteUser(Role.ADMIN)).isTrue();
    }

    @Test
    void userCannotAccessPanel() {
        assertThat(rolePolicy.canAccessPanel(Role.USER)).isFalse();
    }

    @Test
    void adminCanCreateUserRole() {
        assertThat(rolePolicy.canCreateUser(Role.COMPANY_MANAGER, Role.USER)).isTrue();
    }

    @Test
    void adminCannotCreateAdminOrSuperAdminRole() {
        assertThat(rolePolicy.canCreateUser(Role.COMPANY_MANAGER, Role.COMPANY_MANAGER)).isFalse();
        assertThat(rolePolicy.canCreateUser(Role.COMPANY_MANAGER, Role.ADMIN)).isFalse();
    }

    @Test
    void superAdminCanCreateAdminAndSuperAdminRole() {
        assertThat(rolePolicy.canCreateUser(Role.ADMIN, Role.COMPANY_MANAGER)).isTrue();
        assertThat(rolePolicy.canCreateUser(Role.ADMIN, Role.ADMIN)).isTrue();
    }

    @Test
    void superAdminCannotCreateUserRole() {
        assertThat(rolePolicy.canCreateUser(Role.ADMIN, Role.USER)).isFalse();
    }

    @Test
    void userCannotCreateAnyRole() {
        assertThat(rolePolicy.canCreateUser(Role.USER, Role.USER)).isFalse();
    }

    @Test
    void canChangeRoleFollowsSameRulesAsCreation() {
        assertThat(rolePolicy.canChangeRole(Role.COMPANY_MANAGER, Role.USER)).isTrue();
        assertThat(rolePolicy.canChangeRole(Role.COMPANY_MANAGER, Role.COMPANY_MANAGER)).isFalse();
        assertThat(rolePolicy.canChangeRole(Role.ADMIN, Role.COMPANY_MANAGER)).isTrue();
        assertThat(rolePolicy.canChangeRole(Role.ADMIN, Role.USER)).isFalse();
    }

    @Test
    void adminCanDeleteUser() {
        assertThat(rolePolicy.canDeleteUser(Role.COMPANY_MANAGER, Role.USER)).isTrue();
    }

    @Test
    void adminCannotDeleteAdminOrSuperAdmin() {
        assertThat(rolePolicy.canDeleteUser(Role.COMPANY_MANAGER, Role.COMPANY_MANAGER)).isFalse();
        assertThat(rolePolicy.canDeleteUser(Role.COMPANY_MANAGER, Role.ADMIN)).isFalse();
    }

    @Test
    void superAdminCanDeleteAdmin() {
        assertThat(rolePolicy.canDeleteUser(Role.ADMIN, Role.COMPANY_MANAGER)).isTrue();
    }

    @Test
    void superAdminCannotDeleteUser() {
        assertThat(rolePolicy.canDeleteUser(Role.ADMIN, Role.USER)).isFalse();
    }

    @Test
    void userCannotDeleteAnyone() {
        assertThat(rolePolicy.canDeleteUser(Role.USER, Role.USER)).isFalse();
        assertThat(rolePolicy.canDeleteUser(Role.USER, Role.COMPANY_MANAGER)).isFalse();
    }

    @Test
    void assertCanAccessPanelPassesForSuperAdmin() {
        assertThatCode(() -> rolePolicy.assertCanAccessPanel(Role.ADMIN))
                .doesNotThrowAnyException();
    }

    @Test
    void assertCanAccessPanelThrowsForUser() {
        assertThatThrownBy(() -> rolePolicy.assertCanAccessPanel(Role.USER))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    @Test
    void assertCanCreateUserThrowsWhenNotAllowed() {
        assertThatThrownBy(() -> rolePolicy.assertCanCreateUser(Role.COMPANY_MANAGER, Role.ADMIN))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    @Test
    void assertCanChangeRoleThrowsWhenNotAllowed() {
        assertThatThrownBy(() -> rolePolicy.assertCanChangeRole(Role.ADMIN, Role.USER))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    @Test
    void assertCanDeleteUserThrowsWhenNotAllowed() {
        assertThatThrownBy(() -> rolePolicy.assertCanDeleteUser(Role.ADMIN, Role.USER))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    @Test
    void assertCanDeleteUserPassesForAllowedCombination() {
        assertThatCode(() -> rolePolicy.assertCanDeleteUser(Role.COMPANY_MANAGER, Role.USER))
                .doesNotThrowAnyException();
    }

    @Test
    void superAdminCanOnlyDeleteAdmin() {
        assertThat(rolePolicy.deletableRoles(Role.ADMIN))
                .containsExactly(Role.COMPANY_MANAGER);
    }

    @Test
    void adminCanOnlyDeleteUser() {
        assertThat(rolePolicy.deletableRoles(Role.COMPANY_MANAGER))
                .containsExactly(Role.USER);
    }

    @Test
    void userCannotDeleteAnyRole() {
        assertThat(rolePolicy.deletableRoles(Role.USER)).isEmpty();
    }
}
