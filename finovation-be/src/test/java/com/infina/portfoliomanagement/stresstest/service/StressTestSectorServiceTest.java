package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioAssetPathRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestPositionSnapshotRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StressTestSectorServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private StressTestRepository stressTestRepository;

    @Mock
    private StressTestPositionSnapshotRepository snapshotRepository;

    @Mock
    private EquityDetailRepository equityDetailRepository;

    @Mock
    private StressScenarioAssetPathRepository scenarioAssetPathRepository;

    private StressTestSectorService sectorService;

    @BeforeEach
    void setUp() {
        sectorService = new StressTestSectorService(
                userRepository,
                stressTestRepository,
                snapshotRepository,
                equityDetailRepository,
                scenarioAssetPathRepository
        );
    }

    @Test
    void shouldReturnEmptySectorImpactsWhenPortfolioHasNoEquities() {
        String username = "test-user";
        UUID testId = UUID.randomUUID();

        User user = mock(User.class);
        StressTest stressTest = mock(StressTest.class);

        when(user.getId()).thenReturn(1L);
        when(stressTest.getId()).thenReturn(10L);

        when(userRepository.findByUsername(username))
                .thenReturn(Optional.of(user));

        when(stressTestRepository.findByPublicIdAndUserIdAndDeletedFalse(
                testId,
                1L
        )).thenReturn(Optional.of(stressTest));

        when(snapshotRepository.findAllByStressTestIdOrderByWeightDesc(10L))
                .thenReturn(List.of());

        var result = sectorService.getSectorImpacts(
                username,
                testId
        );

        assertTrue(result.isEmpty());

        verifyNoInteractions(
                equityDetailRepository,
                scenarioAssetPathRepository
        );
    }
}