package com.infina.portfoliomanagement.company.controller;

import com.infina.portfoliomanagement.company.controller.docs.CompanyControllerDocs;
import com.infina.portfoliomanagement.company.dto.CompanyResponse;
import com.infina.portfoliomanagement.company.service.CompanyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
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
}
