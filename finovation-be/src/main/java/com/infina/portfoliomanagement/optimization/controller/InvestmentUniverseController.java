package com.infina.portfoliomanagement.optimization.controller;

import com.infina.portfoliomanagement.optimization.controller.docs.InvestmentUniverseControllerDocs;
import com.infina.portfoliomanagement.optimization.dto.InvestmentUniverseAssetResponse;
import com.infina.portfoliomanagement.optimization.service.InvestmentUniverseService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/investment-universe")
@RequiredArgsConstructor
public class InvestmentUniverseController implements InvestmentUniverseControllerDocs {

    private final InvestmentUniverseService investmentUniverseService;

    @Override
    @GetMapping
    public List<InvestmentUniverseAssetResponse> listInvestmentUniverse() {
        return investmentUniverseService.listInvestmentUniverse();
    }
}
