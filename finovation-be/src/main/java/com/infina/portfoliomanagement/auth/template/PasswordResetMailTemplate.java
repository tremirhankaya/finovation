package com.infina.portfoliomanagement.auth.template;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

@Component
public class PasswordResetMailTemplate {

    private static final String CODE_PLACEHOLDER = "{{CODE}}";
    private static final String EXPIRATION_PLACEHOLDER = "{{EXPIRATION_MINUTES}}";

    private final String plainTextTemplate;
    private final String htmlTemplate;

    public PasswordResetMailTemplate(
            @Value("classpath:templates/mail/password-reset-otp.txt") Resource plainTextResource,
            @Value("classpath:templates/mail/password-reset-otp.html") Resource htmlResource
    ) {
        this.plainTextTemplate = read(plainTextResource);
        this.htmlTemplate = read(htmlResource);
    }

    public Content render(String code, long expirationMinutes) {
        String expiration = Long.toString(expirationMinutes);
        return new Content(
                replacePlaceholders(plainTextTemplate, code, expiration),
                replacePlaceholders(htmlTemplate, code, expiration)
        );
    }

    private String replacePlaceholders(String template, String code, String expiration) {
        return template
                .replace(CODE_PLACEHOLDER, code)
                .replace(EXPIRATION_PLACEHOLDER, expiration);
    }

    private String read(Resource resource) {
        try (var inputStream = resource.getInputStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new UncheckedIOException("Password reset mail template could not be loaded.", exception);
        }
    }

    public record Content(String plainText, String html) {
    }
}
