package com.infina.portfoliomanagement.company.controller;

import com.infina.portfoliomanagement.company.controller.docs.CompanyControllerDocs;
import com.infina.portfoliomanagement.company.dto.CreateCompanyRequest;
import com.infina.portfoliomanagement.company.dto.CompanyResponse;
import com.infina.portfoliomanagement.company.service.CompanyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/companies")
@RequiredArgsConstructor
public class CompanyController implements CompanyControllerDocs {

    private final CompanyService companyService;

    @Override
    @GetMapping
    public ResponseEntity<List<CompanyResponse>> getCompanies(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(companyService.getCompanies(userDetails.getUsername()));
    }

    @Override
    @PostMapping
    public ResponseEntity<CompanyResponse> createCompany(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateCompanyRequest request
    ) {
        CompanyResponse response = companyService.createCompany(
                userDetails.getUsername(),
                request
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Override
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCompany(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        companyService.deleteCompany(userDetails.getUsername(), id);
        return ResponseEntity.noContent().build();
    }
}
