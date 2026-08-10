package com.infina.portfoliomanagement.ai.enums;

public enum AiEndpoint {

    CREATE_PORTFOLIO("/api/v1/portfolios/create");

    private final String path;

    AiEndpoint(String path) {
        this.path = path;
    }

    public String getPath() {
        return path;
    }
}
