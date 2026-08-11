package com.infina.portfoliomanagement.fund.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CloneDraftRequest {

    @NotBlank(message = "Fon adı boş bırakılamaz")
    private String name;

    @NotNull(message = "Portföy büyüklüğü boş bırakılamaz")
    @DecimalMin(value = "0.01", message = "Portföy büyüklüğü sıfırdan büyük olmalıdır")
    private BigDecimal initialPortfolioSize;

    @NotNull(message = "Pay fiyatı boş bırakılamaz")
    @DecimalMin(value = "0.01", message = "Pay fiyatı sıfırdan büyük olmalıdır")
    private BigDecimal unitPrice;
}
