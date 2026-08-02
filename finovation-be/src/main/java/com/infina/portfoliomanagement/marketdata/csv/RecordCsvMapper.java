package com.infina.portfoliomanagement.marketdata.csv;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.lang.reflect.RecordComponent;
import java.util.ArrayList;
import java.util.List;


public final class RecordCsvMapper<T extends Record> {

    private final RecordComponent[] components;

    private RecordCsvMapper(Class<T> type) {
        this.components = type.getRecordComponents();
    }

    public static <T extends Record> RecordCsvMapper<T> of(Class<T> type) {
        return new RecordCsvMapper<>(type);
    }

    public List<String> header() {
        List<String> header = new ArrayList<>();
        for (RecordComponent component : components) {
            header.add(columnName(component));
        }
        return header;
    }

    public List<String> toRow(T record) {
        List<String> row = new ArrayList<>();
        for (RecordComponent component : components) {
            Object value = read(component, record);
            row.add(value == null ? "" : escapeFormula(value.toString()));
        }
        return row;
    }

    private String escapeFormula(String cell) {
        if (cell.isEmpty()) {
            return cell;
        }
        char first = cell.charAt(0);
        if (first == '=' || first == '+' || first == '@') {
            return "'" + cell;
        }
        return cell;
    }

    private Object read(RecordComponent component, T record) {
        try {
            return component.getAccessor().invoke(record);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Failed to read record component: " + component.getName(), e);
        }
    }

    private String columnName(RecordComponent component) {
        JsonProperty jsonProperty = component.getAnnotation(JsonProperty.class);
        if (jsonProperty != null && !jsonProperty.value().isEmpty()) {
            return jsonProperty.value();
        }
        return toSnakeCase(component.getName());
    }

    private String toSnakeCase(String camelCase) {
        StringBuilder result = new StringBuilder();
        for (char c : camelCase.toCharArray()) {
            if (Character.isUpperCase(c)) {
                result.append('_').append(Character.toLowerCase(c));
            } else {
                result.append(c);
            }
        }
        return result.toString();
    }
}
