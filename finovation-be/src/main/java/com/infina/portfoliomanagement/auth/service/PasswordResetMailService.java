package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.auth.config.PasswordResetProperties;
import com.infina.portfoliomanagement.auth.template.PasswordResetMailTemplate;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class PasswordResetMailService {

    private static final String SUBJECT = "Finovation şifre yenileme kodu";

    private final JavaMailSender mailSender;
    private final PasswordResetProperties properties;
    private final PasswordResetMailTemplate mailTemplate;

    public void sendOtp(String recipient, String code) {
        long expirationMinutes = properties.otpExpiration().toMinutes();
        PasswordResetMailTemplate.Content content = mailTemplate.render(
                code,
                expirationMinutes
        );

        mailSender.send(mimeMessage -> {
            MimeMessageHelper helper = new MimeMessageHelper(
                    mimeMessage,
                    true,
                    StandardCharsets.UTF_8.name()
            );
            helper.setFrom(properties.sender());
            helper.setTo(recipient);
            helper.setSubject(SUBJECT);
            helper.setText(
                    content.plainText(),
                    content.html()
            );
        });
    }
}
