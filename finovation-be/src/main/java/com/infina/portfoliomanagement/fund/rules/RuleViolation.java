package com.infina.portfoliomanagement.fund.rules;

import com.infina.portfoliomanagement.fund.enums.ConstraintCode;

import java.math.BigDecimal;

public record RuleViolation(
        ConstraintCode code,
        BigDecimal actual,
        ComparisonOperator operator,
        BigDecimal limit
) {

    public static RuleViolation atMost(ConstraintCode code, BigDecimal actual, BigDecimal limit) {
        return new RuleViolation(code, actual, ComparisonOperator.AT_MOST, limit);
    }

    public static RuleViolation atLeast(ConstraintCode code, BigDecimal actual, BigDecimal limit) {
        return new RuleViolation(code, actual, ComparisonOperator.AT_LEAST, limit);
    }

    public static RuleViolation equalTo(ConstraintCode code, BigDecimal actual, BigDecimal limit) {
        return new RuleViolation(code, actual, ComparisonOperator.EQUAL_TO, limit);
    }
}
