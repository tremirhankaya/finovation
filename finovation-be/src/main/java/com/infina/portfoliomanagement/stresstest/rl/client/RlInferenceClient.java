package com.infina.portfoliomanagement.stresstest.rl.client;

import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceRequest;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceResponse;

public interface RlInferenceClient {

    RlInferenceResponse run(RlInferenceRequest request);
}