package com.infina.portfoliomanagement.user.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.user.dto.CreateUserRequest;
import com.infina.portfoliomanagement.user.dto.UpdateUserRequest;
import com.infina.portfoliomanagement.user.dto.UserPageResponse;
import com.infina.portfoliomanagement.user.dto.UserResponse;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;

@Tag(
        name = "Users",
        description = "User management operations."
)
@SuppressWarnings("unused") // Endpoints are invoked by Spring through their controller implementations.
public interface UserControllerDocs {

    @Operation(
            summary = "Create user",
            description = "Creates a new user. COMPANY_MANAGER may only create USER accounts within its own " +
                    "company; ADMIN may only create COMPANY_MANAGER or ADMIN accounts.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<UserResponse> createUser(UserDetails userDetails, CreateUserRequest request);

    @Operation(
            summary = "List users",
            description = "Returns users with optional username/full-name search, role, status, company " +
                    "and createdAt date-range filters. Page size is limited to 10. COMPANY_MANAGER users are scoped " +
                    "to their company; ADMIN may filter by companyId.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<UserPageResponse> getUsers(
            UserDetails userDetails,
            int page,
            int size,
            String q,
            Role role,
            UserStatus status,
            Long companyId,
            LocalDate createdFrom,
            LocalDate createdTo
    );
    @Operation(
            summary = "Update user",
            description = "Updates user profile fields. Username/id cannot be changed. " +
                    "Role changes are restricted by RolePolicy. Password is optional.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<UserResponse> updateUser(
            UserDetails userDetails,
            Long id,
            UpdateUserRequest request
    );

    @Operation(
            summary = "Delete user",
            description = "Deletes a user according to RolePolicy. Self-deletion is not allowed.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<Void> deleteUser(UserDetails userDetails, Long id);
}
