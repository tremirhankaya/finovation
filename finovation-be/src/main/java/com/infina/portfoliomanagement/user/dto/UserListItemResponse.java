package com.infina.portfoliomanagement.user.dto;

import com.infina.portfoliomanagement.user.enums.Role;

import java.time.LocalDateTime;

public record UserListItemResponse(
        Long id,
        String username,
        String fullName,
        Role role,
        LocalDateTime createdAt
) {
}
