package com.infina.portfoliomanagement.security.handler;

import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.common.exception.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class SecurityErrorResponseWriter {

    private final ObjectMapper objectMapper;
    private final Clock clock;

    public void write(
            HttpServletRequest request,
            HttpServletResponse response,
            ErrorCode errorCode
    ) throws IOException {

        ErrorResponse errorResponse = new ErrorResponse(
                LocalDateTime.now(clock),
                errorCode.getHttpStatus().value(),
                errorCode.getCode(),
                errorCode.getMessage(),
                request.getRequestURI(),
                null
        );

        response.setStatus(errorCode.getHttpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());

        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }
}