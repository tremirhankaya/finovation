package com.infina.portfoliomanagement.security.userdetails;

import com.infina.portfoliomanagement.user.enums.Role;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NullMarked;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serial;
import java.time.Instant;
import java.util.Collection;
import java.util.List;

@NullMarked
@RequiredArgsConstructor
public class CustomUserDetails implements UserDetails {

    @Serial
    private static final long serialVersionUID = 1L;

    private final String username;
    private final String password;
    private final Role role;
    private final boolean enabled;
    private final boolean passwordChangeRequired;
    private final Instant credentialsChangedAt;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(
                new SimpleGrantedAuthority("ROLE_" + role.name())
        );
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    public Instant getCredentialsChangedAt() {
        return credentialsChangedAt;
    }

    public Role getRole() {
        return role;
    }

    public boolean isPasswordChangeRequired() {
        return passwordChangeRequired;
    }
}
