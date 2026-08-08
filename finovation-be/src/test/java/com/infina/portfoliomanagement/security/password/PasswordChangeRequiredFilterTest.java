package com.infina.portfoliomanagement.security.password;

import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.security.handler.SecurityErrorResponseWriter;
import com.infina.portfoliomanagement.security.userdetails.CustomUserDetails;
import com.infina.portfoliomanagement.user.enums.Role;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class PasswordChangeRequiredFilterTest {

    @Mock
    private SecurityErrorResponseWriter errorResponseWriter;

    @Mock
    private FilterChain filterChain;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void requiredNonAdminCannotAccessProductEndpoint() throws Exception {
        authenticate(Role.USER, true);
        MockHttpServletRequest request = requestFor("/api/v1/funds/monitoring");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new PasswordChangeRequiredFilter(errorResponseWriter)
                .doFilter(request, response, filterChain);

        verify(errorResponseWriter).write(
                request,
                response,
                ErrorCode.PASSWORD_CHANGE_REQUIRED
        );
        verify(filterChain, never()).doFilter(request, response);
    }

    @Test
    void requiredNonAdminCanAccessPasswordEndpoint() throws Exception {
        authenticate(Role.COMPANY_MANAGER, true);
        MockHttpServletRequest request = requestFor("/api/v1/auth/password");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new PasswordChangeRequiredFilter(errorResponseWriter)
                .doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verify(errorResponseWriter, never()).write(request, response, ErrorCode.PASSWORD_CHANGE_REQUIRED);
    }

    @Test
    void adminIsExemptEvenWhenFlagIsTrue() throws Exception {
        authenticate(Role.ADMIN, true);
        MockHttpServletRequest request = requestFor("/api/v1/users");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new PasswordChangeRequiredFilter(errorResponseWriter)
                .doFilter(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        verify(errorResponseWriter, never()).write(request, response, ErrorCode.PASSWORD_CHANGE_REQUIRED);
    }

    private void authenticate(Role role, boolean passwordChangeRequired) {
        CustomUserDetails principal = new CustomUserDetails(
                "test-user",
                "encoded-password",
                role,
                true,
                passwordChangeRequired,
                Instant.EPOCH
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        principal.getAuthorities()
                )
        );
    }

    private MockHttpServletRequest requestFor(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setServletPath(path);
        return request;
    }
}
