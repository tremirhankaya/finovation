package com.infina.portfoliomanagement.user.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.company.repository.CompanyRepository;
import com.infina.portfoliomanagement.user.dto.CreateUserRequest;
import com.infina.portfoliomanagement.user.dto.UserResponse;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;
import com.infina.portfoliomanagement.user.policy.RolePolicy;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final RolePolicy rolePolicy;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @Transactional
    public UserResponse createUser(String actorUsername, CreateUserRequest request) {

        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        rolePolicy.assertCanCreateUser(actor.getRole(), request.role());

        if (userRepository.existsByUsername(request.username())) {
            throw new BaseException(ErrorCode.USERNAME_ALREADY_EXISTS);
        }

        if (userRepository.existsByEmail(request.email())) {
            throw new BaseException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        Company company = resolveCompany(actor, request.role(), request.companyId());

        LocalDateTime now = LocalDateTime.now(clock);

        User newUser = User.builder()
                .company(company)
                .firstName(request.firstName())
                .lastName(request.lastName())
                .email(request.email())
                .username(request.username())
                .password(passwordEncoder.encode(request.password()))
                .role(request.role())
                .status(UserStatus.ACTIVE)
                .passwordChangeRequired(true)
                .createdAt(now)
                .updatedAt(now)
                .build();

        User saved = userRepository.save(newUser);

        return toResponse(saved);
    }

    private Company resolveCompany(User actor, Role targetRole, Long requestedCompanyId) {

        if (actor.getRole() == Role.ADMIN) {
            return actor.getCompany();
        }

        if (targetRole == Role.SUPER_ADMIN) {
            if (requestedCompanyId != null) {
                throw new BaseException(ErrorCode.COMPANY_ASSIGNMENT_INVALID);
            }
            return null;
        }

        if (requestedCompanyId == null) {
            throw new BaseException(ErrorCode.COMPANY_ASSIGNMENT_INVALID);
        }

        return companyRepository.findById(requestedCompanyId)
                .orElseThrow(() -> new BaseException(ErrorCode.COMPANY_NOT_FOUND));
    }

    private UserResponse toResponse(User user) {

        Company company = user.getCompany();

        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                company != null ? company.getId() : null,
                company != null ? company.getName() : null,
                user.getCreatedAt()
        );
    }
}
