package com.infina.portfoliomanagement.auth.dto;
import jakarta.validation.constraints.NotBlank;

public record LogoutRequest(

        @NotBlank
        String refreshToken

) {
}