package com.infina.portfoliomanagement.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(

        @NotBlank(message = "Username must not be blank.")
        String username,

        @NotBlank(message = "Password must not be blank.")
        String password

) {
}