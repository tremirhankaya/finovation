package com.infina.portfoliomanagement.user.dto;

import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;

import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String username,
        String firstName,
        String lastName,
        String email,
        Role role,
        UserStatus status,
        Long companyId,
        String companyName,
        LocalDateTime createdAt
) {
}
