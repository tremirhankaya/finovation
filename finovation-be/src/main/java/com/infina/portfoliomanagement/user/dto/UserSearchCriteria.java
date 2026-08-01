package com.infina.portfoliomanagement.user.dto;

import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;

import java.time.LocalDate;

public record UserSearchCriteria(
        int page,
        int size,
        String query,
        Role role,
        UserStatus status,
        Long companyId,
        LocalDate createdFrom,
        LocalDate createdTo
) {
    public UserSearchCriteria {
        query = query == null ? "" : query.trim();
    }

    public boolean hasQuery() {
        return !query.isBlank();
    }
}
