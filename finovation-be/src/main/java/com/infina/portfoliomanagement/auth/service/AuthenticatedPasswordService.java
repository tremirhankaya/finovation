package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.auth.dto.PasswordChangeRequest;
import com.infina.portfoliomanagement.auth.store.PasswordResetStore;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthenticatedPasswordService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
    private final PasswordResetStore passwordResetStore;
    private final Clock clock;

    @Transactional
    public void changePassword(String username, PasswordChangeRequest request) {
        if (!request.newPassword().equals(request.newPasswordConfirm())) {
            throw new BaseException(ErrorCode.PASSWORD_RESET_PASSWORDS_DO_NOT_MATCH);
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new BaseException(ErrorCode.PASSWORD_MUST_DIFFER_FROM_CURRENT);
        }

        LocalDateTime now = LocalDateTime.now(clock);
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangeRequired(false);
        user.setUpdatedAt(now);
        user.setCredentialsChangedAt(now);
        userRepository.saveAndFlush(user);

        refreshTokenService.revokeAllForUser(user.getUsername());
        passwordResetStore.revokeResetTokensForUser(user.getUsername());

        log.info("Authenticated password change completed: userId={}", user.getId());
    }
}
