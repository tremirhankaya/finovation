package com.infina.portfoliomanagement.auth.dto;

public record LoginResponse(
        String accessToken,
        String refreshToken
) {
}