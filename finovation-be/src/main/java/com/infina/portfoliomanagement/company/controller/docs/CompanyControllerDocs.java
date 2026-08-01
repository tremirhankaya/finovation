package com.infina.portfoliomanagement.company.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
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
public interface CompanyControllerDocs {

    @Operation(
            summary = "List companies",
            description = "Returns companies visible to the authenticated actor. " +
                    "SUPER_ADMIN receives all active companies. ADMIN receives only its own company.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<List<CompanyResponse>> getCompanies(UserDetails userDetails);
}
