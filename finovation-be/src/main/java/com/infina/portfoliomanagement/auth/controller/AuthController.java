package com.infina.portfoliomanagement.auth.controller;

import com.infina.portfoliomanagement.auth.controller.docs.AuthControllerDocs;
import com.infina.portfoliomanagement.auth.dto.LoginRequest;
import com.infina.portfoliomanagement.auth.dto.LoginResponse;
import com.infina.portfoliomanagement.auth.dto.MeResponse;
import com.infina.portfoliomanagement.auth.dto.RefreshTokenRequest;
import com.infina.portfoliomanagement.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController implements AuthControllerDocs {

    private final AuthService authService;

    @Override
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request
    ) {
        return ResponseEntity.ok(authService.login(request));
    }

    @Override
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request
    ) {
        return ResponseEntity.ok(authService.refreshToken(request));
    }

    @Override
    @GetMapping("/me")
    public ResponseEntity<MeResponse> getCurrentUser(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(
                authService.getCurrentUser(userDetails.getUsername())
        );
    }
}
