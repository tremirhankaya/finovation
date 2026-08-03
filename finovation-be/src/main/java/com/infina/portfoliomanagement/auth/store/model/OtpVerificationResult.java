package com.infina.portfoliomanagement.auth.store.model;

public record OtpVerificationResult(
        OtpVerificationStatus status,
        long attempts
) {
}
