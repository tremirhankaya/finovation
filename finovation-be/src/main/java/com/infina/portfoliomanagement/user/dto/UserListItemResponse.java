package com.infina.portfoliomanagement.user.dto;

import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;

import java.time.LocalDateTime;

public record UserListItemResponse(
        Long id,
        String username,
        String firstName,
        String lastName,
        String fullName,
        String email,
        Long companyId,
        String companyName,
        Role role,
        UserStatus status,
        LocalDateTime createdAt
) {
}
