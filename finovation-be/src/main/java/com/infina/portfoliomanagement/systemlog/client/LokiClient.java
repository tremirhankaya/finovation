package com.infina.portfoliomanagement.systemlog.client;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Component
public class LokiClient {

    private final RestClient restClient;

    public LokiClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder
                .baseUrl("http://loki:3100")
                .build();
    }

    public String queryRange(String query, int limit) {
        URI uri = UriComponentsBuilder
                .fromPath("/loki/api/v1/query_range")
                .queryParam("query", query)
                .queryParam("limit", limit)
                .queryParam("direction", "backward")
                .build()
                .encode()
                .toUri();

        return restClient.get()
                .uri(uri)
                .retrieve()
                .body(String.class);
    }
}