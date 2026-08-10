package com.infina.portfoliomanagement.stresstest.rl.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.rl.client.RlInferenceClient;
import com.infina.portfoliomanagement.stresstest.rl.config.RlProperties;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceRequest;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceResponse;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlPortfolioData;
import com.infina.portfoliomanagement.stresstest.rl.enums.RlScenario;
import com.infina.portfoliomanagement.stresstest.rl.mapper.RlInferenceRequestMapper;
import com.infina.portfoliomanagement.stresstest.rl.validation.RlPortfolioValidator;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class RlStressTestService {

    private final UserRepository userRepository;
    private final RlPortfolioService rlPortfolioService;
    private final RlInferenceRequestMapper requestMapper;
    private final RlInferenceClient inferenceClient;
    private final RlProperties properties;
    private final RlPortfolioValidator portfolioValidator;
    private final RlStressTestPersistenceService persistenceService;

    public RlStressTestService(
            UserRepository userRepository,
            RlPortfolioService rlPortfolioService,
            RlInferenceRequestMapper requestMapper,
            RlInferenceClient inferenceClient,
            RlProperties properties,
            RlPortfolioValidator portfolioValidator,
            RlStressTestPersistenceService persistenceService
    ) {
        this.userRepository = userRepository;
        this.rlPortfolioService = rlPortfolioService;
        this.requestMapper = requestMapper;
        this.inferenceClient = inferenceClient;
        this.properties = properties;
        this.portfolioValidator = portfolioValidator;
        this.persistenceService = persistenceService;
    }

    public RlInferenceResponse run(
            String actorUsername,
            UUID fundId,
            String scenarioCode
    ) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() ->
                        new BaseException(ErrorCode.USER_NOT_FOUND)
                );

        RlPortfolioData portfolio =
                rlPortfolioService.load(
                        fundId,
                        actor.getId()
                );

        portfolioValidator.validate(
                portfolio.positions()
        );

        String rlScenarioCode =
                RlScenario.toRlScenarioCode(
                        scenarioCode
                );

        RlInferenceRequest request =
                requestMapper.map(
                        properties.model(),
                        rlScenarioCode,
                        portfolio.initialNav(),
                        portfolio.positions()
                );

        RlInferenceResponse response =
                inferenceClient.run(request);

        persistenceService.save(
                actor,
                portfolio.fundPortfolio(),
                response
        );

        return response;
    }
}