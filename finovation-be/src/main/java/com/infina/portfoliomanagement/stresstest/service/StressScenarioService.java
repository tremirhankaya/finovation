package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.stresstest.dto.response.StressScenarioResponse;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StressScenarioService {

    private final StressScenarioRepository stressScenarioRepository;

    @Transactional(readOnly = true)
    public List<StressScenarioResponse> getActiveScenarios() {
        return stressScenarioRepository
                .findAllByActiveTrueOrderByDisplayOrderAsc()
                .stream()
                .map(StressScenarioResponse::from)
                .toList();
    }
}