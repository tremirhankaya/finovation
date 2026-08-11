package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import com.infina.portfoliomanagement.stresstest.entity.StressScenarioAssetPath;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.entity.StressTestPositionSnapshot;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StressTestPathServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private StressTestRepository stressTestRepository;

    @Mock
    private StressTestPositionSnapshotRepository snapshotRepository;

    @Mock
    private StressScenarioAssetPathRepository scenarioAssetPathRepository;

    private StressTestPathService pathService;

    @BeforeEach
    void setUp() {
        pathService = new StressTestPathService(
                userRepository,
                stressTestRepository,
                snapshotRepository,
                scenarioAssetPathRepository
        );
    }

    @Test
    void shouldThrowStressTestNotFoundWhenTestDoesNotExist() {
        String username = "test-user";
        UUID testId = UUID.randomUUID();

        User user = mock(User.class);

        when(user.getId()).thenReturn(1L);
        when(userRepository.findByUsername(username))
                .thenReturn(Optional.of(user));

        when(stressTestRepository.findByPublicIdAndUserIdAndDeletedFalse(
                testId,
                1L
        )).thenReturn(Optional.empty());

        BaseException exception = assertThrows(
                BaseException.class,
                () -> pathService.getPortfolioPath(username, testId)
        );

        assertEquals(
                ErrorCode.STRESS_TEST_NOT_FOUND,
                exception.getErrorCode()
        );

        verifyNoInteractions(
                snapshotRepository,
                scenarioAssetPathRepository
        );
    }

    @Test
    void shouldThrowCoverageIncompleteWhenScenarioPathsAreEmpty() {
        String username = "test-user";
        UUID testId = UUID.randomUUID();

        StressTest stressTest = prepareStressTest(username, testId);

        StressTestPositionSnapshot snapshot = mock(StressTestPositionSnapshot.class);

        when(snapshot.getAssetId()).thenReturn(100L);
        when(snapshot.getWeight()).thenReturn(BigDecimal.valueOf(100));

        when(snapshotRepository.findAllByStressTestIdOrderByWeightDesc(
                stressTest.getId()
        )).thenReturn(List.of(snapshot));

        when(scenarioAssetPathRepository
                .findAllByScenarioIdAndAssetIdInOrderByDayIndexAsc(
                        stressTest.getScenario().getId(),
                        List.of(100L)
                ))
                .thenReturn(List.of());

        BaseException exception = assertThrows(
                BaseException.class,
                () -> pathService.getPortfolioPath(username, testId)
        );

        assertEquals(
                ErrorCode.STRESS_SCENARIO_COVERAGE_INCOMPLETE,
                exception.getErrorCode()
        );
    }

    @Test
    void shouldThrowCoverageIncompleteWhenDayHasMissingAssetPath() {
        String username = "test-user";
        UUID testId = UUID.randomUUID();

        StressTest stressTest = prepareStressTest(username, testId);

        StressTestPositionSnapshot firstSnapshot =
                mock(StressTestPositionSnapshot.class);
        StressTestPositionSnapshot secondSnapshot =
                mock(StressTestPositionSnapshot.class);

        when(firstSnapshot.getAssetId()).thenReturn(100L);
        when(firstSnapshot.getWeight()).thenReturn(BigDecimal.valueOf(50));

        when(secondSnapshot.getAssetId()).thenReturn(200L);
        when(secondSnapshot.getWeight()).thenReturn(BigDecimal.valueOf(50));

        when(snapshotRepository.findAllByStressTestIdOrderByWeightDesc(
                stressTest.getId()
        )).thenReturn(List.of(firstSnapshot, secondSnapshot));

        StressScenarioAssetPath onlyOneAssetPath =
                mock(StressScenarioAssetPath.class);

        when(onlyOneAssetPath.getDayIndex())
                .thenReturn((short) 1);

        when(scenarioAssetPathRepository
                .findAllByScenarioIdAndAssetIdInOrderByDayIndexAsc(
                        stressTest.getScenario().getId(),
                        List.of(100L, 200L)
                ))
                .thenReturn(List.of(onlyOneAssetPath));

        BaseException exception = assertThrows(
                BaseException.class,
                () -> pathService.getPortfolioPath(username, testId)
        );

        assertEquals(
                ErrorCode.STRESS_SCENARIO_COVERAGE_INCOMPLETE,
                exception.getErrorCode()
        );
    }

    private StressTest prepareStressTest(
            String username,
            UUID testId
    ) {
        User user = mock(User.class);
        StressTest stressTest = mock(StressTest.class);
        StressScenario scenario = mock(StressScenario.class);

        when(user.getId()).thenReturn(1L);
        when(stressTest.getId()).thenReturn(10L);
        when(stressTest.getScenario()).thenReturn(scenario);
        when(scenario.getId()).thenReturn(20L);

        when(userRepository.findByUsername(username))
                .thenReturn(Optional.of(user));

        when(stressTestRepository.findByPublicIdAndUserIdAndDeletedFalse(
                testId,
                1L
        )).thenReturn(Optional.of(stressTest));

        return stressTest;
    }
}