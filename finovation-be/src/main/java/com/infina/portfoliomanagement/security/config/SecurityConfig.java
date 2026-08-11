package com.infina.portfoliomanagement.security.config;

import com.infina.portfoliomanagement.security.handler.CustomAccessDeniedHandler;
import com.infina.portfoliomanagement.security.handler.CustomAuthenticationEntryPoint;
import com.infina.portfoliomanagement.security.jwt.JwtAuthenticationFilter;
import com.infina.portfoliomanagement.security.password.PasswordChangeRequiredFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private static final String ADMIN_ROLE = "ADMIN";
    private static final String COMPANY_MANAGER_ROLE = "COMPANY_MANAGER";

    private final AuthenticationProvider authenticationProvider;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final PasswordChangeRequiredFilter passwordChangeRequiredFilter;
    private final CustomAuthenticationEntryPoint authenticationEntryPoint;
    private final CustomAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {

        http
                // This API authenticates each request with a bearer JWT and never uses a browser session cookie.
                .csrf(AbstractHttpConfigurer::disable)

                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                .authenticationProvider(authenticationProvider)

                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/auth/login",
                                "/api/v1/auth/refresh",
                                "/api/v1/auth/logout",
                                "/api/v1/auth/password-reset/**",
                                "/v3/api-docs/**",
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/actuator/health",
                                "/actuator/prometheus")
                        .permitAll()
                        .requestMatchers("/api/v1/auth/me", "/api/v1/auth/password")
                        .authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/companies")
                        .hasAnyRole(ADMIN_ROLE, COMPANY_MANAGER_ROLE)
                        .requestMatchers("/api/v1/companies", "/api/v1/companies/**")
                        .hasRole(ADMIN_ROLE)
                        .requestMatchers("/api/v1/users/**")
                        .hasAnyRole(ADMIN_ROLE, COMPANY_MANAGER_ROLE)
                        .requestMatchers("/api/v1/system-logs/**")
                        .hasRole(ADMIN_ROLE)
                        .requestMatchers("/api/v1/**")
                        .hasAnyRole(COMPANY_MANAGER_ROLE, "USER")
                        .anyRequest().authenticated()
                )

                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class
                )
                .addFilterAfter(
                        passwordChangeRequiredFilter,
                        JwtAuthenticationFilter.class
                );

        return http.build();
    }
}
