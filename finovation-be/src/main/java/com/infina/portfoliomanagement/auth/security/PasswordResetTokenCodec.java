package com.infina.portfoliomanagement.auth.security;

import com.infina.portfoliomanagement.auth.config.PasswordResetProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

@Component
@RequiredArgsConstructor
public class PasswordResetTokenCodec {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final PasswordResetProperties properties;

    public String encode(String value) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(
                    properties.secret().getBytes(StandardCharsets.UTF_8),
                    HMAC_ALGORITHM
            ));

            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException exception) {
            throw new IllegalStateException("Password reset token hashing is unavailable.", exception);
        }
    }
}
