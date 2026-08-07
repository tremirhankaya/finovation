package com.infina.portfoliomanagement.company.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCompanyRequest(
        @NotBlank(message = "Company name is required.")
        @Size(max = 150, message = "Company name must not exceed 150 characters.")
        String name
) {
}
