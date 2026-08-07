package com.infina.portfoliomanagement.marketdata.infina.client;

import org.springframework.util.MultiValueMap;

import java.util.List;
import java.util.Optional;

public interface InfinaClient {

    <T> List<T> get(InfinaEndpoint endpoint, MultiValueMap<String, String> params, Class<T> itemType);

    <T> Optional<T> getObject(
            InfinaEndpoint endpoint,
            MultiValueMap<String, String> params,
            Class<T> responseType
    );
}
