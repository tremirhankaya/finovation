package com.infina.portfoliomanagement.fund.enums;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class InvestmentHorizonConverter implements AttributeConverter<InvestmentHorizon, String> {

    @Override
    public String convertToDatabaseColumn(InvestmentHorizon attribute) {
        return attribute == null ? null : attribute.code();
    }

    @Override
    public InvestmentHorizon convertToEntityAttribute(String dbData) {
        return dbData == null ? null : InvestmentHorizon.fromCode(dbData);
    }
}
