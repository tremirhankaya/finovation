package com.infina.portfoliomanagement.auth.controller;

import com.infina.portfoliomanagement.auth.dto.LoginRequest;
import com.infina.portfoliomanagement.auth.dto.LoginResponse;
import com.infina.portfoliomanagement.auth.dto.MeResponse;
import com.infina.portfoliomanagement.auth.dto.RefreshTokenRequest;
import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;

@Tag(
        name = "Authentication",
        description = "Authentication and current user operations."
)
public interface AuthControllerDocs {

    @Operation(
            summary = "Log in",
            description = "Authenticates a user and returns access and refresh tokens."
    )
    ResponseEntity<LoginResponse> login(LoginRequest request);

    @Operation(
            summary = "Refresh tokens",
            description = "Issues a new access and refresh token pair."
    )
    ResponseEntity<LoginResponse> refreshToken(RefreshTokenRequest request);

    @Operation(
            summary = "Get current user",
            description = "Returns the authenticated user's profile.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<MeResponse> getCurrentUser(UserDetails userDetails);
}
