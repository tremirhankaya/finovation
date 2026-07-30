package com.infina.portfoliomanagement.user.dto;

import java.util.List;

public record UserPageResponse(
        List<UserListItemResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext,
        boolean hasPrevious
) {
}
