package com.infina.portfoliomanagement.stresstest.client;

import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressTestRequest;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressTestResponse;

public interface StressTestAiClient {

    AiStressTestResponse runStressTest(AiStressTestRequest request);
}