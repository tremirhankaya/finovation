package com.infina.portfoliomanagement.user.service;

import com.infina.portfoliomanagement.auth.service.RefreshTokenService;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.company.repository.CompanyRepository;
import com.infina.portfoliomanagement.user.dto.*;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;
import com.infina.portfoliomanagement.user.policy.RolePolicy;
import com.infina.portfoliomanagement.user.policy.UserCompanyPolicy;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import com.infina.portfoliomanagement.user.specification.UserSpecifications;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private static final int MAX_PAGE_SIZE = 10;

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final RolePolicy rolePolicy;
    private final UserCompanyPolicy userCompanyPolicy;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
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
                .deleted(false)
                .passwordChangeRequired(true)
                .createdAt(now)
                .updatedAt(now)
                .credentialsChangedAt(now)
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

    @Transactional(readOnly = true)
    public UserPageResponse getUsers(String actorUsername, UserSearchCriteria criteria) {
        validatePagination(criteria.page(), criteria.size());

        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        rolePolicy.assertCanAccessPanel(actor.getRole());

        Long companyId = resolveEffectiveCompanyId(actor, criteria.companyId());

        PageRequest pageRequest = PageRequest.of(
                criteria.page(),
                criteria.size(),
                Sort.by(
                        Sort.Order.desc("createdAt"),
                        Sort.Order.desc("id")
                )
        );

        log.debug(
                "Listing users for actor role {}, companyId {}, roleFilter {}, page {}, size {}, searchApplied {}",
                actor.getRole(),
                companyId,
                criteria.role(),
                criteria.page(),
                criteria.size(),
                criteria.hasQuery()
        );

        Page<UserListItemResponse> users = userRepository
                .findAll(
                        UserSpecifications.from(
                                companyId,
                                criteria.role(),
                                criteria.status(),
                                criteria.query(),
                                criteria.createdFrom(),
                                criteria.createdTo()
                        ),
                        pageRequest
                )
                .map(this::toListItemResponse);

        return new UserPageResponse(
                users.getContent(),
                users.getNumber(),
                users.getSize(),
                users.getTotalElements(),
                users.getTotalPages(),
                users.hasNext(),
                users.hasPrevious()
        );
    }

    private void validatePagination(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new BaseException(
                    ErrorCode.VALIDATION_ERROR,
                    "Page must be non-negative and size must be between 1 and 10."
            );
        }
    }

    private Long resolveEffectiveCompanyId(User actor, Long requestedCompanyId) {
        if (actor.getRole() != Role.ADMIN) {
            return requestedCompanyId;
        }

        if (actor.getCompany() == null) {
            throw new BaseException(ErrorCode.COMPANY_ASSIGNMENT_INVALID);
        }

        Long scopedCompanyId = actor.getCompany().getId();
        userCompanyPolicy.assertCanQueryCompany(
                actor.getRole(),
                scopedCompanyId,
                requestedCompanyId
        );
        return scopedCompanyId;
    }

    private UserListItemResponse toListItemResponse(User user) {
        return new UserListItemResponse(
                user.getId(),
                user.getUsername(),
                user.getFirstName(),
                user.getLastName(),
                user.getFirstName() + " " + user.getLastName(),
                user.getEmail(),
                user.getCompany() != null ? user.getCompany().getId() : null,
                user.getCompany() != null ? user.getCompany().getName() : null,
                user.getRole(),
                user.getStatus(),
                user.getCreatedAt()
        );
    }
    @Transactional
    public UserResponse updateUser(String actorUsername, Long userId, UpdateUserRequest request) {

        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        User target = userRepository.findById(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        rolePolicy.assertCanAccessPanel(actor.getRole());

        userCompanyPolicy.assertCanManageTarget(
                actor.getRole(),
                actor.getCompany() != null ? actor.getCompany().getId() : null,
                target.getCompany() != null ? target.getCompany().getId() : null
        );

        assertCanUpdateRoles(actor, target, request.role());

        if (actor.getId().equals(target.getId()) && request.status() == UserStatus.INACTIVE) {
            throw new BaseException(
                    ErrorCode.VALIDATION_ERROR,
                    "You cannot deactivate your own account."
            );
        }

        if (userRepository.existsByEmailAndIdNot(request.email(), target.getId())) {
            throw new BaseException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        boolean passwordChanged = request.password() != null && !request.password().isBlank();
        Role previousRole = target.getRole();

        target.setFirstName(request.firstName());
        target.setLastName(request.lastName());
        target.setEmail(request.email());
        target.setRole(request.role());
        target.setStatus(request.status());

        Long companyId = request.companyId();
        if (companyId == null && target.getCompany() != null) {
            companyId = target.getCompany().getId();
        }

        userCompanyPolicy.assertCanAssignCompany(
                actor.getRole(),
                actor.getCompany() != null ? actor.getCompany().getId() : null,
                companyId
        );

        target.setCompany(resolveCompany(actor, request.role(), companyId));

        if (passwordChanged) {
            target.setPassword(passwordEncoder.encode(request.password()));
            target.setPasswordChangeRequired(true);
            target.setCredentialsChangedAt(LocalDateTime.now(clock));
        }

        target.setUpdatedAt(LocalDateTime.now(clock));
        UserResponse response = toResponse(userRepository.save(target));

        if (passwordChanged) {
            refreshTokenService.revokeAllForUser(target.getUsername());
        }

        log.info(
                "User updated: actor={}, actorRole={}, targetId={}, roleChanged={}, passwordChanged={}",
                actorUsername,
                actor.getRole(),
                target.getId(),
                previousRole != request.role(),
                passwordChanged
        );

        return response;
    }

    @Transactional
    public void deleteUser(String actorUsername, Long userId) {

        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        User target = userRepository.findById(userId)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        if (actor.getId().equals(target.getId())) {
            log.warn("Self delete denied: actorId={}", actor.getId());
            throw new BaseException(ErrorCode.ACCESS_DENIED, "You cannot delete your own account.");
        }

        rolePolicy.assertCanAccessPanel(actor.getRole());

        userCompanyPolicy.assertCanManageTarget(
                actor.getRole(),
                actor.getCompany() != null ? actor.getCompany().getId() : null,
                target.getCompany() != null ? target.getCompany().getId() : null
        );

        rolePolicy.assertCanDeleteUser(actor.getRole(), target.getRole());

        target.setDeleted(true);
        target.setUpdatedAt(LocalDateTime.now(clock));

        userRepository.saveAndFlush(target);
        refreshTokenService.revokeAllForUser(target.getUsername());

        log.info(
                "User soft-deleted and sessions revoked: actor={}, actorRole={}, targetId={}, targetRole={}",
                actorUsername,
                actor.getRole(),
                target.getId(),
                target.getRole()
        );
    }

    private void assertCanUpdateRoles(User actor, User target, Role requestedRole) {
        if (actor.getId().equals(target.getId())
                && requestedRole != target.getRole()) {
            log.warn(
                    "Self role change denied: actorId={}, currentRole={}, requestedRole={}",
                    actor.getId(),
                    target.getRole(),
                    requestedRole
            );
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }

        if (!actor.getId().equals(target.getId())) {
            rolePolicy.assertCanChangeRole(actor.getRole(), target.getRole());
        }

        if (requestedRole != target.getRole()) {
            rolePolicy.assertCanChangeRole(actor.getRole(), requestedRole);
        }
    }
}
