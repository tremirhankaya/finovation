package com.infina.portfoliomanagement.systemlog.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.infina.portfoliomanagement.systemlog.client.LokiClient;
import com.infina.portfoliomanagement.systemlog.dto.SystemLogResponse;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SystemLogService {

    private static final Set<String> SUPPORTED_LEVELS =
            Set.of("TRACE", "DEBUG", "INFO", "WARN", "ERROR");

    private static final Pattern LEVEL_PATTERN =
            Pattern.compile("\\s(TRACE|DEBUG|INFO|WARN|ERROR)\\s");

    private final LokiClient lokiClient;
    private final ObjectMapper objectMapper;

    public SystemLogService(
            LokiClient lokiClient,
            ObjectMapper objectMapper
    ) {
        this.lokiClient = lokiClient;
        this.objectMapper = objectMapper;
    }

    public List<SystemLogResponse> getLogs(
            String service,
            String level,
            String search,
            int limit
    ) {
        String query = buildQuery(service, level, search);
        String responseBody = lokiClient.queryRange(query, limit);

        return parseLogs(responseBody);
    }

    private String buildQuery(
            String service,
            String level,
            String search
    ) {
        StringBuilder query = new StringBuilder();

        if (StringUtils.hasText(service)) {
            query.append("{service=\"")
                    .append(escape(service))
                    .append("\"}");
        } else {
            query.append("{service!=\"\"}");
        }

        if (StringUtils.hasText(level)) {
            String normalizedLevel = level.toUpperCase(Locale.ROOT);

            if (SUPPORTED_LEVELS.contains(normalizedLevel)) {
                query.append(" |= \" ")
                        .append(normalizedLevel)
                        .append(" \"");
            }
        }

        if (StringUtils.hasText(search)) {
            query.append(" |= \"")
                    .append(escape(search))
                    .append("\"");
        }

        return query.toString();
    }

    private List<SystemLogResponse> parseLogs(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode streams = root.path("data").path("result");

            List<SystemLogResponse> logs = new ArrayList<>();

            for (JsonNode stream : streams) {
                String service = stream.path("stream")
                        .path("service")
                        .asText("unknown");

                for (JsonNode value : stream.path("values")) {
                    String timestamp = value.get(0).asText();
                    String message = value.get(1).asText();

                    logs.add(new SystemLogResponse(
                            toInstant(timestamp),
                            detectLevel(message),
                            service,
                            message
                    ));
                }
            }

            logs.sort(
                    Comparator.comparing(SystemLogResponse::timestamp)
                            .reversed()
            );

            return logs;
        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Failed to parse Loki response",
                    exception
            );
        }
    }

    private Instant toInstant(String nanoseconds) {
        long value = Long.parseLong(nanoseconds);

        long seconds = value / 1_000_000_000L;
        long nanos = value % 1_000_000_000L;

        return Instant.ofEpochSecond(seconds, nanos);
    }

    private String detectLevel(String message) {
        Matcher matcher = LEVEL_PATTERN.matcher(message);

        return matcher.find()
                ? matcher.group(1)
                : "UNKNOWN";
    }

    private String escape(String value) {
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}