package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.auth.dto.LoginRequest;
import com.infina.portfoliomanagement.auth.dto.LoginResponse;
import com.infina.portfoliomanagement.auth.dto.MeResponse;
import com.infina.portfoliomanagement.auth.dto.RefreshTokenRequest;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.security.jwt.JwtService;
import com.infina.portfoliomanagement.security.userdetails.CustomUserDetailsService;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String TOKEN_TYPE = "Bearer";

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final CustomUserDetailsService customUserDetailsService;
    private final UserRepository userRepository;

    public LoginResponse login(LoginRequest request) {

        try {
            UserDetails userDetails = (UserDetails) authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.username(),
                            request.password()
                    )
            ).getPrincipal();

            return createTokenResponse(userDetails);

        } catch (AuthenticationException exception) {
            throw new BaseException(ErrorCode.INVALID_CREDENTIALS);
        }
    }

    public LoginResponse refreshToken(RefreshTokenRequest request) {

        try {
            String refreshToken = request.refreshToken();

            String username = jwtService.extractUsername(refreshToken);

            UserDetails userDetails =
                    customUserDetailsService.loadUserByUsername(username);

            if (!jwtService.isRefreshTokenValid(refreshToken, userDetails)) {
                throw new BaseException(ErrorCode.INVALID_TOKEN);
            }

            return createTokenResponse(userDetails);

        } catch (ExpiredJwtException exception) {
            throw new BaseException(ErrorCode.TOKEN_EXPIRED);

        } catch (JwtException | IllegalArgumentException exception) {
            throw new BaseException(ErrorCode.INVALID_TOKEN);
        }
    }

    @Transactional(readOnly = true)
    public MeResponse getCurrentUser(String username) {

        User user = userRepository.findByUsername(username)
                .orElseThrow(() ->
                        new BaseException(ErrorCode.USER_NOT_FOUND)
                );

        Company company = user.getCompany();

        return new MeResponse(
                user.getId(),
                user.getUsername(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.isPasswordChangeRequired(),
                company != null ? company.getId() : null,
                company != null ? company.getName() : null
        );
    }

    private LoginResponse createTokenResponse(UserDetails userDetails) {

        String accessToken = jwtService.generateAccessToken(userDetails);
        String refreshToken = jwtService.generateRefreshToken(userDetails);

        return new LoginResponse(
                accessToken,
                refreshToken,
                TOKEN_TYPE
        );
    }
}