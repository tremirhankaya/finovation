package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.auth.dto.LoginRequest;
import com.infina.portfoliomanagement.auth.dto.LoginResponse;
import com.infina.portfoliomanagement.auth.dto.LogoutRequest;
import com.infina.portfoliomanagement.auth.dto.MeResponse;
import com.infina.portfoliomanagement.auth.dto.RefreshTokenRequest;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.security.jwt.JwtService;
import com.infina.portfoliomanagement.security.userdetails.CustomUserDetailsService;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.policy.RolePolicy;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final CustomUserDetailsService customUserDetailsService;
    private final UserRepository userRepository;
    private final RolePolicy rolePolicy;
    private final RefreshTokenService refreshTokenService;

    public LoginResponse login(LoginRequest request) {

        try {
            Authentication authentication =
                    authenticationManager.authenticate(
                            new UsernamePasswordAuthenticationToken(
                                    request.username(),
                                    request.password()
                            )
                    );

            Object principal = authentication.getPrincipal();

            if (!(principal instanceof UserDetails userDetails)) {
                throw new BaseException(ErrorCode.INVALID_CREDENTIALS);
            }

            return createTokenResponse(userDetails);

        } catch (AuthenticationException exception) {
            throw new BaseException(ErrorCode.INVALID_CREDENTIALS);
        }
    }

    public LoginResponse refreshToken(RefreshTokenRequest request) {

        String refreshToken = request.refreshToken();

        String username =
                refreshTokenService.getUsername(refreshToken);

        if (username == null) {
            throw new BaseException(ErrorCode.INVALID_TOKEN);
        }

        UserDetails userDetails =
                customUserDetailsService.loadUserByUsername(username);

        refreshTokenService.revoke(refreshToken);

        String accessToken =
                jwtService.generateAccessToken(userDetails);

        String newRefreshToken =
                refreshTokenService.create(userDetails.getUsername());

        return new LoginResponse(
                accessToken,
                newRefreshToken
        );
    }

    public void logout(LogoutRequest request) {
        refreshTokenService.revoke(request.refreshToken());
    }

    @Transactional(readOnly = true)
    public MeResponse getCurrentUser(String username) {

        User user = userRepository.findByUsername(username)
                .orElseThrow(() ->
                        new BaseException(ErrorCode.USER_NOT_FOUND)
                );

        Company company = user.getCompany();
        Role role = user.getRole();

        return new MeResponse(
                user.getId(),
                user.getUsername(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                role,
                user.getStatus(),
                user.isPasswordChangeRequired(),
                company != null ? company.getId() : null,
                company != null ? company.getName() : null,
                rolePolicy.canAccessPanel(role),
                rolePolicy.canCreateUser(role),
                rolePolicy.canDeleteUser(role),
                rolePolicy.assignableRoles(role)
        );
    }

    private LoginResponse createTokenResponse(UserDetails userDetails) {

        String accessToken =
                jwtService.generateAccessToken(userDetails);

        String refreshToken =
                refreshTokenService.create(userDetails.getUsername());

        return new LoginResponse(
                accessToken,
                refreshToken
        );
    }
}
