package com.infina.portfoliomanagement.company.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.company.dto.CreateCompanyRequest;
import com.infina.portfoliomanagement.company.dto.CompanyResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;

@Tag(
        name = "Companies",
        description = "Company lookup operations for panel filters and assignment UIs."
)
@SuppressWarnings("unused") // Endpoints are invoked by Spring through their controller implementations.
public interface CompanyControllerDocs {

    @Operation(
            summary = "List companies",
            description = "Returns companies visible to the authenticated actor. " +
                    "ADMIN receives all active companies. COMPANY_MANAGER receives only its own company.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<List<CompanyResponse>> getCompanies(UserDetails userDetails);

    @Operation(
            summary = "Create company",
            description = "Creates an active company. Available only to ADMIN.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<CompanyResponse> createCompany(
            UserDetails userDetails,
            CreateCompanyRequest request
    );

    @Operation(
            summary = "Delete company",
            description = "Soft-deletes the company and all of its active users. " +
                    "Available only to ADMIN.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<Void> deleteCompany(UserDetails userDetails, Long id);
}
