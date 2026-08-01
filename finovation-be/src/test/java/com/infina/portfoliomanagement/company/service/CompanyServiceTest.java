package com.infina.portfoliomanagement.company.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.company.dto.CompanyResponse;
import com.infina.portfoliomanagement.company.entity.Company;
import com.infina.portfoliomanagement.company.enums.CompanyStatus;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompanyServiceTest {

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private UserRepository userRepository;

    private CompanyService companyService;

    private Company acme;
    private Company beta;
    private User adminActor;
    private User superAdminActor;
    private User regularUser;

    @BeforeEach
    void setUp() {
        companyService = new CompanyService(
                companyRepository,
                userRepository,
                new RolePolicy()
        );

        acme = Company.builder().id(10L).name("Acme").status(CompanyStatus.ACTIVE).build();
        beta = Company.builder().id(20L).name("Beta").status(CompanyStatus.ACTIVE).build();

        adminActor = User.builder()
                .id(1L)
                .username("admin1")
                .role(Role.ADMIN)
                .company(acme)
                .build();

        superAdminActor = User.builder()
                .id(2L)
                .username("superadmin1")
                .role(Role.SUPER_ADMIN)
                .company(null)
                .build();

        regularUser = User.builder()
                .id(3L)
                .username("user1")
                .role(Role.USER)
                .company(acme)
                .build();
    }

    @Test
    void superAdmin_listsAllActiveCompaniesOrderedByName() {
        when(userRepository.findByUsername("superadmin1")).thenReturn(Optional.of(superAdminActor));
        when(companyRepository.findAllByStatusOrderByNameAsc(CompanyStatus.ACTIVE))
                .thenReturn(List.of(acme, beta));

        List<CompanyResponse> response = companyService.getCompanies("superadmin1");

        assertThat(response).containsExactly(
                new CompanyResponse(10L, "Acme"),
                new CompanyResponse(20L, "Beta")
        );
        verify(companyRepository).findAllByStatusOrderByNameAsc(CompanyStatus.ACTIVE);
    }

    @Test
    void admin_listsOnlyOwnCompany() {
        when(userRepository.findByUsername("admin1")).thenReturn(Optional.of(adminActor));

        List<CompanyResponse> response = companyService.getCompanies("admin1");

        assertThat(response).containsExactly(new CompanyResponse(10L, "Acme"));
        verifyNoInteractions(companyRepository);
    }

    @Test
    void adminWithoutCompany_throwsAssignmentInvalid() {
        User adminWithoutCompany = User.builder()
                .id(4L)
                .username("admin-orphan")
                .role(Role.ADMIN)
                .company(null)
                .build();

        when(userRepository.findByUsername("admin-orphan"))
                .thenReturn(Optional.of(adminWithoutCompany));

        assertThatThrownBy(() -> companyService.getCompanies("admin-orphan"))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.COMPANY_ASSIGNMENT_INVALID);
    }

    @Test
    void regularUser_isDeniedPanelAccess() {
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(regularUser));

        assertThatThrownBy(() -> companyService.getCompanies("user1"))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);

        verifyNoInteractions(companyRepository);
    }

    @Test
    void unknownActor_throwsUserNotFound() {
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> companyService.getCompanies("missing"))
                .isInstanceOf(BaseException.class)
                .extracting(ex -> ((BaseException) ex).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }
}
