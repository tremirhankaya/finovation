package com.infina.portfoliomanagement.user.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.company.repository.CompanyRepository;
import com.infina.portfoliomanagement.user.dto.CreateUserRequest;
import com.infina.portfoliomanagement.user.dto.UserPageResponse;
import com.infina.portfoliomanagement.user.dto.UserResponse;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;
import com.infina.portfoliomanagement.user.policy.RolePolicy;
import com.infina.portfoliomanagement.user.policy.UserCompanyPolicy;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-07-30T10:00:00Z"), ZoneOffset.UTC);

    @Mock
    private UserRepository userRepository;

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserService userService;

    private Company company;
    private User adminActor;
    private User superAdminActor;

    @BeforeEach
    void setUp() {
        userService = new UserService(
                userRepository,
                companyRepository,
                new RolePolicy(),
                new UserCompanyPolicy(),
                passwordEncoder,
                FIXED_CLOCK
        );

        company = Company.builder().id(10L).name("Acme").build();

        adminActor = User.builder()
                .id(1L)
                .username("admin1")
                .role(Role.ADMIN)
                .company(company)
                .build();

        superAdminActor = User.builder()
                .id(2L)
                .username("superadmin1")
                .role(Role.SUPER_ADMIN)
                .company(null)
                .build();

        lenient().when(passwordEncoder.encode(anyString())).thenReturn("encoded-password");
        lenient().when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private CreateUserRequest requestFor(Role role, Long companyId) {
        return new CreateUserRequest(
                "newuser",
                "First",
                "Last",
                "newuser@example.com",
                "password123",
                role,
                companyId
        );
    }

    @Test
    void adminCreatesUser_inheritsOwnCompany() {
        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("newuser@example.com")).thenReturn(false);

        UserResponse response = userService.createUser("admin1", requestFor(Role.USER, null));

        assertThat(response.companyId()).isEqualTo(10L);
        assertThat(response.role()).isEqualTo(Role.USER);
        assertThat(response.status()).isEqualTo(UserStatus.ACTIVE);
        verify(passwordEncoder).encode("password123");
    }

    @Test
    void adminCreatingAdminRole_isDeniedByRolePolicy() {
        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));

        assertThatThrownBy(() -> userService.createUser("admin1", requestFor(Role.ADMIN, null)))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    @Test
    void superAdminCreatesAdmin_withoutCompanyId_isRejected() {
        when(userRepository.findByUsername("superadmin1")).thenReturn(Optional.of(superAdminActor));
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("newuser@example.com")).thenReturn(false);

        assertThatThrownBy(() -> userService.createUser("superadmin1", requestFor(Role.ADMIN, null)))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.COMPANY_ASSIGNMENT_INVALID);
    }

    @Test
    void superAdminCreatesAdmin_withValidCompanyId_succeeds() {
        when(userRepository.findByUsername("superadmin1")).thenReturn(Optional.of(superAdminActor));
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("newuser@example.com")).thenReturn(false);
        when(companyRepository.findById(10L)).thenReturn(Optional.of(company));

        UserResponse response = userService.createUser("superadmin1", requestFor(Role.ADMIN, 10L));

        assertThat(response.companyId()).isEqualTo(10L);
        assertThat(response.role()).isEqualTo(Role.ADMIN);
    }

    @Test
    void superAdminCreatesAdmin_withUnknownCompanyId_throwsCompanyNotFound() {
        when(userRepository.findByUsername("superadmin1")).thenReturn(Optional.of(superAdminActor));
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("newuser@example.com")).thenReturn(false);
        when(companyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.createUser("superadmin1", requestFor(Role.ADMIN, 99L)))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.COMPANY_NOT_FOUND);
    }

    @Test
    void superAdminCreatesSuperAdmin_withCompanyId_isRejected() {
        when(userRepository.findByUsername("superadmin1")).thenReturn(Optional.of(superAdminActor));
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("newuser@example.com")).thenReturn(false);

        assertThatThrownBy(() -> userService.createUser("superadmin1", requestFor(Role.SUPER_ADMIN, 10L)))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.COMPANY_ASSIGNMENT_INVALID);
    }

    @Test
    void superAdminCreatesSuperAdmin_withoutCompanyId_succeeds() {
        when(userRepository.findByUsername("superadmin1")).thenReturn(Optional.of(superAdminActor));
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("newuser@example.com")).thenReturn(false);

        UserResponse response = userService.createUser("superadmin1", requestFor(Role.SUPER_ADMIN, null));

        assertThat(response.companyId()).isNull();
        assertThat(response.role()).isEqualTo(Role.SUPER_ADMIN);
    }

    @Test
    void duplicateUsername_throwsUsernameAlreadyExists() {
        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.existsByUsername("newuser")).thenReturn(true);

        assertThatThrownBy(() -> userService.createUser("admin1", requestFor(Role.USER, null)))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.USERNAME_ALREADY_EXISTS);
    }

    @Test
    void duplicateEmail_throwsEmailAlreadyExists() {
        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("newuser@example.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.createUser("admin1", requestFor(Role.USER, null)))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    @Test
    void unknownActor_throwsUserNotFound() {
        when(userRepository.findByUsername("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.createUser("ghost", requestFor(Role.USER, null)))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    void adminListsOnlyUsersInOwnCompany() {
        User listedUser = listedUser(11L, "company.user", Role.USER);

        when(userRepository.findByUsername("admin1"))
                .thenReturn(Optional.of(adminActor));
        when(userRepository.searchUsers(
                eq(10L),
                eq("company"),
                any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(listedUser)));

        UserPageResponse response =
                userService.getUsers("admin1", 0, 10, "  company  ");

        assertThat(response.content()).hasSize(1);
        assertThat(response.content().getFirst().id()).isEqualTo(11L);
        assertThat(response.content().getFirst().username()).isEqualTo("company.user");
        assertThat(response.content().getFirst().fullName()).isEqualTo("Listed User");
        assertThat(response.content().getFirst().role()).isEqualTo(Role.USER);

        verify(userRepository).searchUsers(
                eq(10L),
                eq("company"),
                any(Pageable.class)
        );
    }

    @Test
    void superAdminListsUsersAcrossAllCompanies() {
        when(userRepository.findByUsername("superadmin1"))
                .thenReturn(Optional.of(superAdminActor));
        when(userRepository.searchUsers(
                eq(null),
                eq(""),
                any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of()));

        UserPageResponse response =
                userService.getUsers("superadmin1", 0, 10, null);

        assertThat(response.content()).isEmpty();

        verify(userRepository).searchUsers(
                eq(null),
                eq(""),
                any(Pageable.class)
        );
    }

    @Test
    void userRoleCannotListUsers() {
        User userActor = User.builder()
                .id(3L)
                .username("user1")
                .role(Role.USER)
                .company(company)
                .build();

        when(userRepository.findByUsername("user1"))
                .thenReturn(Optional.of(userActor));

        assertThatThrownBy(() ->
                userService.getUsers("user1", 0, 10, "")
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);

        verify(userRepository, never()).searchUsers(
                any(),
                anyString(),
                any(Pageable.class)
        );
    }

    @Test
    void listUsersRejectsPageSizeGreaterThanTen() {
        assertThatThrownBy(() ->
                userService.getUsers("admin1", 0, 11, "")
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_ERROR);

        verify(userRepository, never()).findByUsername(anyString());
    }

    @Test
    void listUsersRejectsNegativePage() {
        assertThatThrownBy(() ->
                userService.getUsers("admin1", -1, 10, "")
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_ERROR);

        verify(userRepository, never()).findByUsername(anyString());
    }

    @Test
    void adminWithoutCompanyCannotListUsers() {
        User invalidAdmin = User.builder()
                .id(4L)
                .username("invalid.admin")
                .role(Role.ADMIN)
                .company(null)
                .build();

        when(userRepository.findByUsername("invalid.admin"))
                .thenReturn(Optional.of(invalidAdmin));

        assertThatThrownBy(() ->
                userService.getUsers("invalid.admin", 0, 10, "")
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.COMPANY_ASSIGNMENT_INVALID);

        verify(userRepository, never()).searchUsers(
                any(),
                anyString(),
                any(Pageable.class)
        );
    }

    private User listedUser(Long id, String username, Role role) {
        return User.builder()
                .id(id)
                .username(username)
                .firstName("Listed")
                .lastName("User")
                .email(username + "@example.com")
                .password("encoded-password")
                .role(role)
                .status(UserStatus.ACTIVE)
                .deleted(false)
                .company(company)
                .createdAt(LocalDateTime.of(2026, 7, 30, 10, 0))
                .updatedAt(LocalDateTime.of(2026, 7, 30, 10, 0))
                .build();
    }
}
