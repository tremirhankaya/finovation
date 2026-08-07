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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final RolePolicy rolePolicy;
    private final CompanyManagementPolicy companyManagementPolicy;
    private final RefreshTokenService refreshTokenService;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<CompanyResponse> getCompanies(String actorUsername) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        rolePolicy.assertCanAccessPanel(actor.getRole());
        List<Company> companies = resolveVisibleCompanies(actor);

        log.debug(
                "Listing companies for actor role {}, count {}",
                actor.getRole(),
                companies.size()
        );

        return companies.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CompanyResponse createCompany(
            String actorUsername,
            CreateCompanyRequest request
    ) {
        User actor = requireActor(actorUsername);
        companyManagementPolicy.assertCanManageCompanies(actor.getRole());

        String name = request.name().trim();
        if (companyRepository.existsByNameIgnoreCase(name)) {
            throw new BaseException(ErrorCode.COMPANY_NAME_ALREADY_EXISTS);
        }

        LocalDateTime now = LocalDateTime.now(clock);
        Company company = Company.builder()
                .name(name)
                .status(CompanyStatus.ACTIVE)
                .deleted(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
        Company saved = companyRepository.saveAndFlush(company);

        log.info(
                "Company created: actorId={}, companyId={}",
                actor.getId(),
                saved.getId()
        );
        return toResponse(saved);
    }

    @Transactional
    public void deleteCompany(String actorUsername, Long companyId) {
        User actor = requireActor(actorUsername);
        companyManagementPolicy.assertCanManageCompanies(actor.getRole());

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new BaseException(ErrorCode.COMPANY_NOT_FOUND));
        List<User> companyUsers = userRepository.findAllByCompanyId(companyId);
        LocalDateTime now = LocalDateTime.now(clock);

        companyUsers.forEach(user -> {
            user.setDeleted(true);
            user.setUpdatedAt(now);
        });
        if (!companyUsers.isEmpty()) {
            userRepository.saveAllAndFlush(companyUsers);
        }

        company.setDeleted(true);
        company.setUpdatedAt(now);
        companyRepository.saveAndFlush(company);

        companyUsers.forEach(user ->
                refreshTokenService.revokeAllForUser(user.getUsername())
        );

        log.info(
                "Company soft-deleted with users: actorId={}, companyId={}, deletedUserCount={}",
                actor.getId(),
                companyId,
                companyUsers.size()
        );
    }

    private User requireActor(String actorUsername) {
        return userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
    }

    private List<Company> resolveVisibleCompanies(User actor) {
        if (actor.getRole() == Role.SUPER_ADMIN) {
            return companyRepository.findAllByStatusOrderByNameAsc(CompanyStatus.ACTIVE);
        }

        if (actor.getCompany() == null) {
            throw new BaseException(ErrorCode.COMPANY_ASSIGNMENT_INVALID);
        }

        return List.of(actor.getCompany());
    }

    private CompanyResponse toResponse(Company company) {
        return new CompanyResponse(company.getId(), company.getName());
    }
}
