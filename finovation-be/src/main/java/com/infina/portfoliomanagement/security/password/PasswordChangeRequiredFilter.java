package com.infina.portfoliomanagement.security.password;

import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.security.handler.SecurityErrorResponseWriter;
import com.infina.portfoliomanagement.security.userdetails.CustomUserDetails;
import com.infina.portfoliomanagement.user.enums.Role;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class PasswordChangeRequiredFilter extends OncePerRequestFilter {

    private static final String API_PREFIX = "/api/v1/";
    private static final Set<String> ALLOWED_PATHS = Set.of(
            "/api/v1/auth/login",
            "/api/v1/auth/me",
            "/api/v1/auth/password",
            "/api/v1/auth/refresh",
            "/api/v1/auth/logout"
    );

    private final SecurityErrorResponseWriter errorResponseWriter;

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getServletPath();
        return !path.startsWith(API_PREFIX)
                || ALLOWED_PATHS.contains(path)
                || path.startsWith("/api/v1/auth/password-reset/");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null
                && authentication.getPrincipal() instanceof CustomUserDetails userDetails
                && userDetails.getRole() != Role.ADMIN
                && userDetails.isPasswordChangeRequired()) {
            errorResponseWriter.write(request, response, ErrorCode.PASSWORD_CHANGE_REQUIRED);
            return;
        }

        filterChain.doFilter(request, response);
    }
}
