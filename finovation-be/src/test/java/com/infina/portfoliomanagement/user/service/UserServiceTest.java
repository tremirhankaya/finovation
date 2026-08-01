package com.infina.portfoliomanagement.user.service;

import com.infina.portfoliomanagement.auth.service.RefreshTokenService;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.company.repository.CompanyRepository;
import com.infina.portfoliomanagement.user.dto.CreateUserRequest;
import com.infina.portfoliomanagement.user.dto.UpdateUserRequest;
import com.infina.portfoliomanagement.user.dto.UserPageResponse;
import com.infina.portfoliomanagement.user.dto.UserResponse;
import com.infina.portfoliomanagement.user.dto.UserSearchCriteria;
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
import org.springframework.data.jpa.domain.Specification;
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

    @Mock
    private RefreshTokenService refreshTokenService;

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
                refreshTokenService,
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
                "Password123!",
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
        verify(passwordEncoder).encode("Password123!");
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
        when(userRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(listedUser)));

        UserPageResponse response =
                userService.getUsers("admin1", criteria(0, 10, "  company  ", null, null, null));

        assertThat(response.content()).hasSize(1);
        assertThat(response.content().getFirst().id()).isEqualTo(11L);
        assertThat(response.content().getFirst().username()).isEqualTo("company.user");
        assertThat(response.content().getFirst().fullName()).isEqualTo("Listed User");
        assertThat(response.content().getFirst().firstName()).isEqualTo("Listed");
        assertThat(response.content().getFirst().lastName()).isEqualTo("User");
        assertThat(response.content().getFirst().email()).isEqualTo("company.user@example.com");
        assertThat(response.content().getFirst().companyId()).isEqualTo(10L);
        assertThat(response.content().getFirst().companyName()).isEqualTo("Acme");
        assertThat(response.content().getFirst().role()).isEqualTo(Role.USER);
        assertThat(response.content().getFirst().status()).isEqualTo(UserStatus.ACTIVE);

        verify(userRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void superAdminListsUsersAcrossAllCompanies() {
        when(userRepository.findByUsername("superadmin1"))
                .thenReturn(Optional.of(superAdminActor));
        when(userRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        UserPageResponse response =
                userService.getUsers("superadmin1", criteria(0, 10, null, null, null, null));

        assertThat(response.content()).isEmpty();

        verify(userRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void superAdminCanFilterByRoleAndCompany() {
        when(userRepository.findByUsername("superadmin1"))
                .thenReturn(Optional.of(superAdminActor));
        when(userRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        userService.getUsers("superadmin1", criteria(0, 10, "", Role.ADMIN, null, 10L));

        verify(userRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void superAdminCanFilterByStatus() {
        when(userRepository.findByUsername("superadmin1"))
                .thenReturn(Optional.of(superAdminActor));
        when(userRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        userService.getUsers(
                "superadmin1",
                criteria(0, 10, "", null, UserStatus.INACTIVE, null)
        );

        verify(userRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void adminFilteringOtherCompanyIsDenied() {
        when(userRepository.findByUsername("admin1"))
                .thenReturn(Optional.of(adminActor));

        assertThatThrownBy(() ->
                userService.getUsers("admin1", criteria(0, 10, "", null, null, 99L))
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);

        verify(userRepository, never()).findAll(any(Specification.class), any(Pageable.class));
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
                userService.getUsers("user1", criteria(0, 10, "", null, null, null))
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);

        verify(userRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void listUsersRejectsPageSizeGreaterThanTen() {
        assertThatThrownBy(() ->
                userService.getUsers("admin1", criteria(0, 11, "", null, null, null))
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_ERROR);

        verify(userRepository, never()).findByUsername(anyString());
    }

    @Test
    void listUsersRejectsNegativePage() {
        assertThatThrownBy(() ->
                userService.getUsers("admin1", criteria(-1, 10, "", null, null, null))
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
                userService.getUsers("invalid.admin", criteria(0, 10, "", null, null, null))
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.COMPANY_ASSIGNMENT_INVALID);

        verify(userRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void adminUpdatesUserInOwnCompany() {
        User target = listedUser(11L, "company.user", Role.USER);

        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.findById(11L)).thenReturn(Optional.of(target));
        when(userRepository.existsByEmailAndIdNot("updated@example.com", 11L)).thenReturn(false);

        UserResponse response = userService.updateUser(
                "admin1",
                11L,
                updateRequest("Updated", "Name", "updated@example.com", null, Role.USER, 10L)
        );

        assertThat(response.firstName()).isEqualTo("Updated");
        assertThat(response.lastName()).isEqualTo("Name");
        assertThat(response.email()).isEqualTo("updated@example.com");
        assertThat(response.companyId()).isEqualTo(10L);
        assertThat(target.isPasswordChangeRequired()).isFalse();
        verify(passwordEncoder, never()).encode(anyString());
        verify(userRepository).save(target);
    }

    @Test
    void adminUpdatesUserInOtherCompany_isDenied() {
        Company otherCompany = Company.builder().id(99L).name("Other").build();
        User target = listedUser(12L, "other.user", Role.USER);
        target.setCompany(otherCompany);

        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.findById(12L)).thenReturn(Optional.of(target));

        assertThatThrownBy(() ->
                userService.updateUser(
                        "admin1",
                        12L,
                        updateRequest("Updated", "Name", "updated@example.com", null, Role.USER, 99L)
                )
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void adminCannotChangeOwnRole() {
        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminActor));

        assertThatThrownBy(() ->
                userService.updateUser(
                        "admin1",
                        1L,
                        updateRequest("Admin", "One", "admin1@example.com", null, Role.USER, 10L)
                )
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void adminCannotDeactivateOwnAccount() {
        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminActor));

        assertThatThrownBy(() ->
                userService.updateUser(
                        "admin1",
                        1L,
                        new UpdateUserRequest(
                                "Admin",
                                "One",
                                "admin1@example.com",
                                null,
                                Role.ADMIN,
                                UserStatus.INACTIVE,
                                10L
                        )
                )
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_ERROR);

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateUser_duplicateEmail_throwsEmailAlreadyExists() {
        User target = listedUser(11L, "company.user", Role.USER);

        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.findById(11L)).thenReturn(Optional.of(target));
        when(userRepository.existsByEmailAndIdNot("taken@example.com", 11L)).thenReturn(true);

        assertThatThrownBy(() ->
                userService.updateUser(
                        "admin1",
                        11L,
                        updateRequest("Updated", "Name", "taken@example.com", null, Role.USER, 10L)
                )
        )
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.EMAIL_ALREADY_EXISTS);

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void adminSoftDeletesUserInOwnCompany() {
        User target = listedUser(11L, "company.user", Role.USER);

        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.findById(11L)).thenReturn(Optional.of(target));

        userService.deleteUser("admin1", 11L);

        assertThat(target.isDeleted()).isTrue();
        assertThat(target.getUpdatedAt()).isEqualTo(LocalDateTime.of(2026, 7, 30, 10, 0));
        verify(userRepository).save(target);
    }

    @Test
    void adminCannotDeleteOwnAccount() {
        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminActor));

        assertThatThrownBy(() -> userService.deleteUser("admin1", 1L))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void adminCannotDeleteAdmin() {
        User targetAdmin = listedUser(13L, "other.admin", Role.ADMIN);

        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));
        when(userRepository.findById(13L)).thenReturn(Optional.of(targetAdmin));

        assertThatThrownBy(() -> userService.deleteUser("admin1", 13L))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);

        verify(userRepository, never()).save(any(User.class));
    }

    private UpdateUserRequest updateRequest(
            String firstName,
            String lastName,
            String email,
            String password,
            Role role,
            Long companyId
    ) {
        return new UpdateUserRequest(
                firstName,
                lastName,
                email,
                password,
                role,
                UserStatus.ACTIVE,
                companyId
        );
    }

    private UserSearchCriteria criteria(
            int page,
            int size,
            String query,
            Role role,
            UserStatus status,
            Long companyId
    ) {
        return new UserSearchCriteria(
                page,
                size,
                query,
                role,
                status,
                companyId,
                null,
                null
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
