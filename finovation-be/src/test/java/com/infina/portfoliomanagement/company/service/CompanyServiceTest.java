package com.infina.portfoliomanagement.company.service;

import com.infina.portfoliomanagement.auth.service.RefreshTokenService;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.company.dto.CreateCompanyRequest;
import com.infina.portfoliomanagement.company.dto.CompanyResponse;
import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.company.enums.CompanyStatus;
import com.infina.portfoliomanagement.company.policy.CompanyManagementPolicy;
import com.infina.portfoliomanagement.company.repository.CompanyRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.policy.RolePolicy;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompanyServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 8, 7, 10, 0);

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenService refreshTokenService;

    private CompanyService companyService;
    private User superAdminActor;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(
                Instant.parse("2026-08-07T10:00:00Z"),
                ZoneOffset.UTC
        );
        companyService = new CompanyService(
                companyRepository,
                userRepository,
                new RolePolicy(),
                new CompanyManagementPolicy(),
                refreshTokenService,
                clock
        );
        superAdminActor = User.builder()
                .id(1L)
                .username("superadmin")
                .role(Role.SUPER_ADMIN)
                .build();
    }

    @Test
    void superAdmin_listsAllActiveCompaniesOrderedByName() {
        Company acme = company(10L, "Acme");
        Company beta = company(20L, "Beta");
        when(userRepository.findByUsername("superadmin"))
                .thenReturn(Optional.of(superAdminActor));
        when(companyRepository.findAllByStatusOrderByNameAsc(CompanyStatus.ACTIVE))
                .thenReturn(List.of(acme, beta));

        List<CompanyResponse> response = companyService.getCompanies("superadmin");

        assertThat(response).containsExactly(
                new CompanyResponse(10L, "Acme"),
                new CompanyResponse(20L, "Beta")
        );
    }

    @Test
    void admin_listsOnlyOwnCompany() {
        Company ownCompany = company(10L, "Acme");
        User admin = User.builder()
                .id(2L)
                .username("admin")
                .role(Role.ADMIN)
                .company(ownCompany)
                .build();
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

        List<CompanyResponse> response = companyService.getCompanies("admin");

        assertThat(response).containsExactly(new CompanyResponse(10L, "Acme"));
        verifyNoInteractions(companyRepository);
    }

    @Test
    void admin_cannotCreateCompany() {
        User admin = User.builder()
                .id(2L)
                .username("admin")
                .role(Role.ADMIN)
                .company(company(10L, "Acme"))
                .build();
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> companyService.createCompany(
                "admin",
                new CreateCompanyRequest("Yeni Şirket")
        ))
                .isInstanceOf(BaseException.class)
                .extracting(error -> ((BaseException) error).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);

        verify(companyRepository, never()).saveAndFlush(any());
    }

    @Test
    void superAdmin_createsTrimmedActiveCompany() {
        when(userRepository.findByUsername("superadmin"))
                .thenReturn(Optional.of(superAdminActor));
        when(companyRepository.existsByNameIgnoreCase("Yeni Şirket"))
                .thenReturn(false);
        when(companyRepository.saveAndFlush(any(Company.class)))
                .thenAnswer(invocation -> {
                    Company saved = invocation.getArgument(0);
                    saved.setId(30L);
                    return saved;
                });

        CompanyResponse response = companyService.createCompany(
                "superadmin",
                new CreateCompanyRequest("  Yeni Şirket  ")
        );

        assertThat(response).isEqualTo(new CompanyResponse(30L, "Yeni Şirket"));
        verify(companyRepository).saveAndFlush(argThat(company ->
                company.getName().equals("Yeni Şirket")
                        && company.getStatus() == CompanyStatus.ACTIVE
                        && !company.isDeleted()
                        && company.getCreatedAt().equals(NOW)
                        && company.getUpdatedAt().equals(NOW)
        ));
    }

    @Test
    void duplicateActiveCompanyName_isRejected() {
        when(userRepository.findByUsername("superadmin"))
                .thenReturn(Optional.of(superAdminActor));
        when(companyRepository.existsByNameIgnoreCase("Acme")).thenReturn(true);

        assertThatThrownBy(() -> companyService.createCompany(
                "superadmin",
                new CreateCompanyRequest("Acme")
        ))
                .isInstanceOf(BaseException.class)
                .extracting(error -> ((BaseException) error).getErrorCode())
                .isEqualTo(ErrorCode.COMPANY_NAME_ALREADY_EXISTS);

        verify(companyRepository, never()).saveAndFlush(any());
    }

    @Test
    void deleteCompany_softDeletesCompanyAndUsersAndRevokesSessions() {
        Company company = company(10L, "Acme");
        User admin = companyUser(20L, "admin", company);
        User user = companyUser(21L, "user", company);
        when(userRepository.findByUsername("superadmin"))
                .thenReturn(Optional.of(superAdminActor));
        when(companyRepository.findById(10L)).thenReturn(Optional.of(company));
        when(userRepository.findAllByCompanyId(10L)).thenReturn(List.of(admin, user));

        companyService.deleteCompany("superadmin", 10L);

        assertThat(company.isDeleted()).isTrue();
        assertThat(company.getUpdatedAt()).isEqualTo(NOW);
        assertThat(List.of(admin, user)).allMatch(User::isDeleted);
        assertThat(List.of(admin, user))
                .allMatch(companyUser -> NOW.equals(companyUser.getUpdatedAt()));
        verify(userRepository).saveAllAndFlush(List.of(admin, user));
        verify(companyRepository).saveAndFlush(company);
        verify(refreshTokenService).revokeAllForUser("admin");
        verify(refreshTokenService).revokeAllForUser("user");
    }

    @Test
    void deleteUnknownCompany_returnsStableNotFoundCode() {
        when(userRepository.findByUsername("superadmin"))
                .thenReturn(Optional.of(superAdminActor));
        when(companyRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> companyService.deleteCompany("superadmin", 99L))
                .isInstanceOf(BaseException.class)
                .extracting(error -> ((BaseException) error).getErrorCode())
                .isEqualTo(ErrorCode.COMPANY_NOT_FOUND);

        verify(userRepository, never()).findAllByCompanyId(anyLong());
    }

    private Company company(Long id, String name) {
        return Company.builder()
                .id(id)
                .name(name)
                .status(CompanyStatus.ACTIVE)
                .deleted(false)
                .build();
    }

    private User companyUser(Long id, String username, Company company) {
        return User.builder()
                .id(id)
                .username(username)
                .role(Role.ADMIN)
                .company(company)
                .deleted(false)
                .build();
    }
}
