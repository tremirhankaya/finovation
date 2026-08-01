package com.infina.portfoliomanagement.auth.dto;

import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;

import java.util.Set;

public record MeResponse(
        Long id,
        String username,
        String firstName,
        String lastName,
        String email,
        Role role,
        UserStatus status,
        boolean passwordChangeRequired,
        Long companyId,
        String companyName,
        boolean canAccessPanel,
        boolean canCreateUser,
        boolean canDeleteUser,
        Set<Role> assignableRoles,
        Set<Role> deletableRoles
) {
}
