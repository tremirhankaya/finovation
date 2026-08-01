package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.auth.config.PasswordResetProperties;
import com.infina.portfoliomanagement.auth.template.PasswordResetMailTemplate;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessagePreparator;

import java.time.Duration;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

@ExtendWith(MockitoExtension.class)
class PasswordResetMailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    @Test
    void sendOtp_createsMultipartMessageWithPlainTextAndHtmlAlternatives() throws Exception {
        PasswordResetProperties properties = new PasswordResetProperties(
                "test-secret",
                "no-reply@finovation.local",
                Duration.ofMinutes(10),
                Duration.ofMinutes(10),
                Duration.ofMinutes(1),
                5
        );
        PasswordResetMailTemplate template = new PasswordResetMailTemplate(
                new ClassPathResource("templates/mail/password-reset-otp.txt"),
                new ClassPathResource("templates/mail/password-reset-otp.html")
        );
        PasswordResetMailService service = new PasswordResetMailService(
                mailSender,
                properties,
                template
        );
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));

        doAnswer(invocation -> {
            MimeMessagePreparator preparator = invocation.getArgument(0);
            preparator.prepare(message);
            return null;
        }).when(mailSender).send(any(MimeMessagePreparator.class));

        service.sendOtp("user@example.com", "123456");

        assertThat(message.getSubject()).isEqualTo("Finovation şifre yenileme kodu");
        assertThat(message.getAllRecipients()[0].toString()).isEqualTo("user@example.com");
        assertThat(message.getContent()).isInstanceOf(MimeMultipart.class);

        String content = extractText(message.getContent());
        assertThat(content).contains("123456");
        assertThat(content).contains("Şifre yenileme");
        assertThat(content).contains("10 dakika");
    }

    private String extractText(Object content) throws Exception {
        if (content instanceof String text) {
            return text;
        }
        if (content instanceof MimeMultipart multipart) {
            StringBuilder text = new StringBuilder();
            for (int index = 0; index < multipart.getCount(); index++) {
                text.append(extractText(multipart.getBodyPart(index).getContent()));
            }
            return text.toString();
        }
        return "";
    }
}
