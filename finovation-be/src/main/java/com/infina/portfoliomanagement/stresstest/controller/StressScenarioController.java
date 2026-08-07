package com.infina.portfoliomanagement.stresstest.controller;

import com.infina.portfoliomanagement.stresstest.controller.docs.StressScenarioControllerDocs;
import com.infina.portfoliomanagement.stresstest.dto.response.StressScenarioResponse;
import com.infina.portfoliomanagement.stresstest.service.StressScenarioService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/stress-scenarios")
@RequiredArgsConstructor
public class StressScenarioController implements StressScenarioControllerDocs {

    private final StressScenarioService stressScenarioService;

    @Override
    @GetMapping
    public List<StressScenarioResponse> listScenarios() {
        return stressScenarioService.getActiveScenarios();
    }
}