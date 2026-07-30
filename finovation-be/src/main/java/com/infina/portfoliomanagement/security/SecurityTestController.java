package com.infina.portfoliomanagement.security;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/security-test")
public class SecurityTestController {

    @GetMapping
    public ResponseEntity<String> test() {
        return ResponseEntity.ok("Authentication successful.");
    }
}