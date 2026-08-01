package com.infina.portfoliomanagement.security.jwt;

import com.infina.portfoliomanagement.security.userdetails.CustomUserDetails;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private static final String TOKEN_TYPE_CLAIM = "token_type";
    private static final String ACCESS_TOKEN_TYPE = "access";
    private static final String REFRESH_TOKEN_TYPE = "refresh";

    private final JwtProperties jwtProperties;
    private final Clock clock;
    private final SecretKey signingKey;
    private final JwtParser jwtParser;

    public JwtService(
            JwtProperties jwtProperties,
            Clock clock
    ) {
        this.jwtProperties = jwtProperties;
        this.clock = clock;

        byte[] keyBytes = Decoders.BASE64.decode(jwtProperties.secret());

        this.signingKey = Keys.hmacShaKeyFor(keyBytes);

        this.jwtParser = Jwts.parser()
                .verifyWith(signingKey)
                .build();
    }

    public String generateAccessToken(UserDetails userDetails) {
        return buildToken(
                userDetails.getUsername(),
                ACCESS_TOKEN_TYPE,
                jwtProperties.accessTokenExpiration()
        );
    }

    public String generateRefreshToken(UserDetails userDetails) {
        return buildToken(
                userDetails.getUsername(),
                REFRESH_TOKEN_TYPE,
                jwtProperties.refreshTokenExpiration()
        );
    }

    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    public Instant extractExpiration(String token) {
        return extractAllClaims(token)
                .getExpiration()
                .toInstant();
    }

    public boolean isAccessTokenValid(
            String token,
            UserDetails userDetails
    ) {
        return isTokenValid(
                token,
                userDetails,
                ACCESS_TOKEN_TYPE
        );
    }

    public boolean isRefreshTokenValid(
            String token,
            UserDetails userDetails
    ) {
        return isTokenValid(
                token,
                userDetails,
                REFRESH_TOKEN_TYPE
        );
    }

    private String buildToken(
            String username,
            String tokenType,
            Duration expirationDuration
    ) {
        Instant issuedAt = clock.instant();
        Instant expiresAt = issuedAt.plus(expirationDuration);

        return Jwts.builder()
                .subject(username)
                .claim(TOKEN_TYPE_CLAIM, tokenType)
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    private boolean isTokenValid(
            String token,
            UserDetails userDetails,
            String expectedTokenType
    ) {
        try {
            Claims claims = extractAllClaims(token);

            String username = claims.getSubject();
            String tokenType = claims.get(
                    TOKEN_TYPE_CLAIM,
                    String.class
            );

            return username.equals(userDetails.getUsername())
                    && expectedTokenType.equals(tokenType)
                    && userDetails.isEnabled()
                    && userDetails.isAccountNonLocked()
                    && userDetails.isAccountNonExpired()
                    && userDetails.isCredentialsNonExpired()
                    && isIssuedAfterCredentialsChanged(claims, userDetails);

        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }

    private boolean isIssuedAfterCredentialsChanged(
            Claims claims,
            UserDetails userDetails
    ) {
        if (!(userDetails instanceof CustomUserDetails customUserDetails)) {
            return true;
        }

        Date issuedAt = claims.getIssuedAt();
        Instant credentialsChangedAt = customUserDetails.getCredentialsChangedAt();

        if (issuedAt == null || credentialsChangedAt == null) {
            return false;
        }

        return !issuedAt.toInstant().truncatedTo(ChronoUnit.SECONDS)
                .isBefore(credentialsChangedAt.truncatedTo(ChronoUnit.SECONDS));
    }

    private Claims extractAllClaims(String token) {
        return jwtParser
                .parseSignedClaims(token)
                .getPayload();
    }
}