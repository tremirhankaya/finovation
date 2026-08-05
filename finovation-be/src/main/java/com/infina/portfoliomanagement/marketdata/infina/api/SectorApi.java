package com.infina.portfoliomanagement.marketdata.infina.api;

import com.infina.portfoliomanagement.marketdata.infina.client.InfinaClient;
import com.infina.portfoliomanagement.marketdata.infina.client.InfinaEndpoint;
import com.infina.portfoliomanagement.marketdata.infina.dto.SectorRecord;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;

import java.util.List;

@Component
public class SectorApi {

    private final InfinaClient infinaClient;

    public SectorApi(InfinaClient infinaClient) {
        this.infinaClient = infinaClient;
    }

    public List<SectorRecord> fetchAll() {
        return infinaClient.get(
                InfinaEndpoint.SECTOR_DEFINITION,
                new LinkedMultiValueMap<>(),
                SectorRecord.class);
    }
}
