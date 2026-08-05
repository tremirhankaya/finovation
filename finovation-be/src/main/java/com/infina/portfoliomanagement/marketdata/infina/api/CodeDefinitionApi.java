package com.infina.portfoliomanagement.marketdata.infina.api;

import com.infina.portfoliomanagement.marketdata.infina.client.InfinaClient;
import com.infina.portfoliomanagement.marketdata.infina.client.InfinaEndpoint;
import com.infina.portfoliomanagement.marketdata.infina.dto.CodeDefinitionRecord;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.List;

@Component
public class CodeDefinitionApi {

    private static final String EQUITY_ASSET_TYPE = "EQUITY";

    private final InfinaClient infinaClient;

    public CodeDefinitionApi(InfinaClient infinaClient) {
        this.infinaClient = infinaClient;
    }

    public List<CodeDefinitionRecord> fetchEquities(String code) {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("asset_type", EQUITY_ASSET_TYPE);
        params.add("code", code);

        return infinaClient.get(InfinaEndpoint.CODE_DEFINITION, params, CodeDefinitionRecord.class);
    }
}
