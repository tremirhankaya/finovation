package com.infina.portfoliomanagement.user.policy;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.user.enums.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
public class RolePolicy {

    private static final Map<Role, Set<Role>> ASSIGNABLE_ROLES = new EnumMap<>(Role.class);
    private static final Map<Role, Role> MANAGED_ROLE = new EnumMap<>(Role.class);

    static {
        ASSIGNABLE_ROLES.put(Role.SUPER_ADMIN, EnumSet.of(Role.ADMIN, Role.SUPER_ADMIN));
        ASSIGNABLE_ROLES.put(Role.ADMIN, EnumSet.of(Role.USER));
        ASSIGNABLE_ROLES.put(Role.USER, EnumSet.noneOf(Role.class));

        MANAGED_ROLE.put(Role.SUPER_ADMIN, Role.ADMIN);
        MANAGED_ROLE.put(Role.ADMIN, Role.USER);
    }

    public Set<Role> assignableRoles(Role actor) {
        return ASSIGNABLE_ROLES.getOrDefault(actor, EnumSet.noneOf(Role.class));
    }

    public boolean canAccessPanel(Role actor) {
        return actor == Role.ADMIN || actor == Role.SUPER_ADMIN;
    }

    public boolean canCreateUser(Role actor, Role targetRole) {
        return assignableRoles(actor).contains(targetRole);
    }

    public boolean canCreateUser(Role actor) {
        return !assignableRoles(actor).isEmpty();
    }

    public boolean canChangeRole(Role actor, Role targetRole) {
        return canCreateUser(actor, targetRole);
    }

    public boolean canDeleteUser(Role actor, Role targetRole) {
        return targetRole == MANAGED_ROLE.get(actor);
    }

    public boolean canDeleteUser(Role actor) {
        return MANAGED_ROLE.containsKey(actor);
    }

    public void assertCanAccessPanel(Role actor) {
        if (!canAccessPanel(actor)) {
            log.debug("Panel access denied for role {}", actor);
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
    }

    public void assertCanCreateUser(Role actor, Role targetRole) {
        if (!canCreateUser(actor, targetRole)) {
            log.debug("Role {} is not allowed to create a user with role {}", actor, targetRole);
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
    }

    public void assertCanChangeRole(Role actor, Role targetRole) {
        if (!canChangeRole(actor, targetRole)) {
            log.debug("Role {} is not allowed to assign role {}", actor, targetRole);
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
    }

    public void assertCanDeleteUser(Role actor, Role targetRole) {
        if (!canDeleteUser(actor, targetRole)) {
            log.debug("Role {} is not allowed to delete a user with role {}", actor, targetRole);
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
    }
}
