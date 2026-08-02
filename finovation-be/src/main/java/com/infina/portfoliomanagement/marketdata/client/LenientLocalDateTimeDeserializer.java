package com.infina.portfoliomanagement.marketdata.client;

import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.deser.std.StdDeserializer;

import java.time.LocalDate;
import java.time.LocalDateTime;


public class LenientLocalDateTimeDeserializer extends StdDeserializer<LocalDateTime> {

    public LenientLocalDateTimeDeserializer() {
        super(LocalDateTime.class);
    }

    @Override
    public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) {
        String text = parser.getString();
        if (text == null || text.isBlank()) {
            return null;
        }
        return text.contains("T")
                ? LocalDateTime.parse(text)
                : LocalDate.parse(text).atStartOfDay();
    }
}
