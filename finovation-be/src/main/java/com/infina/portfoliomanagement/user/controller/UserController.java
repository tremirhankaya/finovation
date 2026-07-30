package com.infina.portfoliomanagement.user.controller;

import com.infina.portfoliomanagement.user.controller.docs.UserControllerDocs;
import com.infina.portfoliomanagement.user.dto.CreateUserRequest;
import com.infina.portfoliomanagement.user.dto.UserPageResponse;
import com.infina.portfoliomanagement.user.dto.UserResponse;
import com.infina.portfoliomanagement.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController implements UserControllerDocs {

    private final UserService userService;

    @Override
    @PostMapping
    public ResponseEntity<UserResponse> createUser(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateUserRequest request
    ) {
        UserResponse response = userService.createUser(userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Override
    @GetMapping
    public ResponseEntity<UserPageResponse> getUsers(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "") String q
    ) {
        return ResponseEntity.ok(
                userService.getUsers(
                        userDetails.getUsername(),
                        page,
                        size,
                        q
                )
        );
    }
}
