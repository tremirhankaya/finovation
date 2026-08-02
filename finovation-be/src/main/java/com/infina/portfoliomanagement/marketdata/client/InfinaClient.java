package com.infina.portfoliomanagement.marketdata.client;

import org.springframework.util.MultiValueMap;

import java.util.List;

public interface InfinaClient {
    <T> List<T> get(String endpoint, MultiValueMap<String, String> params, Class<T> itemType);
}