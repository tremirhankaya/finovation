package com.infina.portfoliomanagement.auth.controller.docs;

import com.infina.portfoliomanagement.auth.dto.LoginRequest;
import com.infina.portfoliomanagement.auth.dto.LoginResponse;
import com.infina.portfoliomanagement.auth.dto.MeResponse;
import com.infina.portfoliomanagement.auth.dto.RefreshTokenRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetStartRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetVerifyRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetVerifyResponse;
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

    @Operation(
            summary = "Request a password reset code",
            description = "Sends a single-use verification code to the account email address."
    )
    void requestPasswordReset(PasswordResetStartRequest request);

    @Operation(
            summary = "Verify a password reset code",
            description = "Verifies the email code and returns a short-lived, single-use reset token."
    )
    ResponseEntity<PasswordResetVerifyResponse> verifyPasswordResetOtp(
            PasswordResetVerifyRequest request
    );

    @Operation(
            summary = "Reset a password",
            description = "Updates the password using a verified, single-use reset token."
    )
    void resetPassword(PasswordResetRequest request);
}
