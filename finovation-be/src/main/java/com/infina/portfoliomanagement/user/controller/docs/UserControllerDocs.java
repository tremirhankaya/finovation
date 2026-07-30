package com.infina.portfoliomanagement.user.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.user.dto.CreateUserRequest;
import com.infina.portfoliomanagement.user.dto.UserPageResponse;
import com.infina.portfoliomanagement.user.dto.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;

@Tag(
        name = "Users",
        description = "User management operations."
)
public interface UserControllerDocs {

    @Operation(
            summary = "Create user",
            description = "Creates a new user. ADMIN may only create USER accounts within its own " +
                    "company; SUPER_ADMIN may only create ADMIN or SUPER_ADMIN accounts.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<UserResponse> createUser(UserDetails userDetails, CreateUserRequest request);

    @Operation(
            summary = "List users",
            description = "Returns users with optional username or full-name search. " +
                    "Page size is limited to 10. ADMIN users are scoped to their company.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<UserPageResponse> getUsers(
            UserDetails userDetails,
            int page,
            int size,
            String q
    );
}
