package com.infina.portfoliomanagement.integration.security;

import com.infina.portfoliomanagement.auth.dto.LoginRequest;
import com.infina.portfoliomanagement.auth.dto.LoginResponse;
import com.infina.portfoliomanagement.auth.dto.RefreshTokenRequest;
import com.infina.portfoliomanagement.auth.service.RefreshTokenService;
import com.infina.portfoliomanagement.integration.AbstractIntegrationTest;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.enums.UserStatus;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SecurityMockMvcIntegrationTest extends AbstractIntegrationTest {

    private static final String LOGIN_ENDPOINT = "/api/v1/auth/login";
    private static final String REFRESH_ENDPOINT = "/api/v1/auth/refresh";
    private static final String ME_ENDPOINT = "/api/v1/auth/me";

    private static final String USERNAME = "integration-user";
    private static final String PASSWORD = "TestPassword123!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RefreshTokenService refreshTokenService;

    private User testUser;

    @BeforeEach
    void setUpUser() {
        userRepository.deleteAll();

        LocalDateTime now = LocalDateTime.now();

        User user = User.builder()
                .company(null)
                .firstName("Integration")
                .lastName("User")
                .email("integration-user@finovation.test")
                .username(USERNAME)
                .password(passwordEncoder.encode(PASSWORD))
                .role(Role.ADMIN)
                .status(UserStatus.ACTIVE)
                .passwordChangeRequired(false)
                .deleted(false)
                .createdAt(now)
                .updatedAt(now)
                .credentialsChangedAt(now.minusSeconds(1))
                .build();

        testUser = userRepository.saveAndFlush(user);
    }

    @Test
    void getCurrentUser_withoutAccessToken_returnsAuthenticationRequired()
            throws Exception {

        mockMvc.perform(get(ME_ENDPOINT))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON
                ))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("AUTH_005"))
                .andExpect(jsonPath("$.message").value(
                        "Authentication is required to access this resource."
                ))
                .andExpect(jsonPath("$.path").value(ME_ENDPOINT))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void getCurrentUser_withMalformedAccessToken_returnsInvalidToken()
            throws Exception {

        mockMvc.perform(
                        get(ME_ENDPOINT)
                                .header(
                                        HttpHeaders.AUTHORIZATION,
                                        "Bearer not-a-valid-jwt"
                                )
                )
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON
                ))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("AUTH_002"))
                .andExpect(jsonPath("$.message").value("Invalid token."))
                .andExpect(jsonPath("$.path").value(ME_ENDPOINT))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void login_withValidCredentials_returnsTokenPair()
            throws Exception {

        LoginRequest request = new LoginRequest(
                USERNAME,
                PASSWORD
        );

        mockMvc.perform(
                        post(LOGIN_ENDPOINT)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        objectMapper.writeValueAsString(request)
                                )
                )
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON
                ))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty());
    }

    @Test
    void login_withInvalidPassword_returnsInvalidCredentials()
            throws Exception {

        LoginRequest request = new LoginRequest(
                USERNAME,
                "wrong-password"
        );

        mockMvc.perform(
                        post(LOGIN_ENDPOINT)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        objectMapper.writeValueAsString(request)
                                )
                )
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON
                ))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("AUTH_001"))
                .andExpect(jsonPath("$.message").value(
                        "Invalid username or password."
                ))
                .andExpect(jsonPath("$.path").value(LOGIN_ENDPOINT))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void getCurrentUser_withValidAccessToken_returnsAuthenticatedUser()
            throws Exception {

        String accessToken = loginAndExtractAccessToken();

        mockMvc.perform(
                        get(ME_ENDPOINT)
                                .header(
                                        HttpHeaders.AUTHORIZATION,
                                        "Bearer " + accessToken
                                )
                )
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON
                ))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.username").value(USERNAME))
                .andExpect(jsonPath("$.firstName").value("Integration"))
                .andExpect(jsonPath("$.lastName").value("User"))
                .andExpect(jsonPath("$.email").value(
                        "integration-user@finovation.test"
                ))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.passwordChangeRequired").value(false))
                .andExpect(jsonPath("$.canAccessPanel").value(true));
    }

    @Test
    void refreshToken_usedTwice_secondRequestReturnsInvalidToken()
            throws Exception {

        LoginResponse loginResponse = loginAndExtractTokenPair();
        String refreshToken = loginResponse.refreshToken();

        performRefresh(refreshToken)
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON
                ))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty());

        assertRefreshRejected(refreshToken);
    }

    @Test
    void refreshToken_inactiveUser_returnsInvalidToken()
            throws Exception {

        LoginResponse loginResponse = loginAndExtractTokenPair();

        changeUserStatus(UserStatus.INACTIVE);

        assertRefreshRejected(loginResponse.refreshToken());
    }

    @Test
    void refreshToken_lockedUser_returnsInvalidToken()
            throws Exception {

        LoginResponse loginResponse = loginAndExtractTokenPair();

        changeUserStatus(UserStatus.LOCKED);

        assertRefreshRejected(loginResponse.refreshToken());
    }

    @Test
    void refreshToken_unknownUser_returnsInvalidToken()
            throws Exception {

        String refreshToken =
                refreshTokenService.create("unknown-integration-user");

        assertRefreshRejected(refreshToken);
    }

    private String loginAndExtractAccessToken() throws Exception {
        return loginAndExtractTokenPair().accessToken();
    }

    private LoginResponse loginAndExtractTokenPair() throws Exception {
        LoginRequest request = new LoginRequest(
                USERNAME,
                PASSWORD
        );

        String responseBody = mockMvc.perform(
                        post(LOGIN_ENDPOINT)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        objectMapper.writeValueAsString(request)
                                )
                )
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readValue(
                responseBody,
                LoginResponse.class
        );
    }

    private ResultActions performRefresh(String refreshToken)
            throws Exception {

        RefreshTokenRequest request =
                new RefreshTokenRequest(refreshToken);

        return mockMvc.perform(
                post(REFRESH_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                objectMapper.writeValueAsString(request)
                        )
        );
    }

    private void assertRefreshRejected(String refreshToken)
            throws Exception {

        performRefresh(refreshToken)
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(
                        MediaType.APPLICATION_JSON
                ))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("AUTH_002"))
                .andExpect(jsonPath("$.message").value("Invalid token."))
                .andExpect(jsonPath("$.path").value(REFRESH_ENDPOINT))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    private void changeUserStatus(UserStatus status) {
        testUser.setStatus(status);
        testUser = userRepository.saveAndFlush(testUser);
    }
}