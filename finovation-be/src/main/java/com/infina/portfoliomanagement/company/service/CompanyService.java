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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final RolePolicy rolePolicy;

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
