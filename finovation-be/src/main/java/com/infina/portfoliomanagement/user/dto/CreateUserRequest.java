package com.infina.portfoliomanagement.user.dto;

import com.infina.portfoliomanagement.user.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(

        @NotBlank(message = "Username must not be blank.")
        @Size(max = 100, message = "Username must be at most 100 characters.")
        String username,

        @NotBlank(message = "First name must not be blank.")
        @Size(max = 100, message = "First name must be at most 100 characters.")
        String firstName,

        @NotBlank(message = "Last name must not be blank.")
        @Size(max = 100, message = "Last name must be at most 100 characters.")
        String lastName,

        @NotBlank(message = "Email must not be blank.")
        @Email(message = "Email must be a valid email address.")
        @Size(max = 254, message = "Email must be at most 254 characters.")
        String email,

        @NotBlank(message = "Password must not be blank.")
        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters.")
        String password,

        @NotNull(message = "Role must not be null.")
        Role role,

        Long companyId

) {
}
