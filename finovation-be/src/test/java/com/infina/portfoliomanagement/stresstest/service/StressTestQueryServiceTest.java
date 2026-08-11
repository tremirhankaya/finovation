package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import com.infina.portfoliomanagement.stresstest.enums.StressTestStatus;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StressTestQueryServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private StressTestRepository stressTestRepository;

    @Mock
    private StressTestPositionSnapshotRepository snapshotRepository;

    private StressTestQueryService queryService;

    @BeforeEach
    void setUp() {
        queryService = new StressTestQueryService(
                userRepository,
                stressTestRepository,
                snapshotRepository
        );
    }

    @Test
    void getLatestHistory_returnsOnlyLatestCompletedTest() {
        String username = "test-user";
        User user = mock(User.class);
        StressTest stressTest = mock(StressTest.class);
        StressScenario scenario = mock(StressScenario.class);
        UUID testId = UUID.randomUUID();
        LocalDate asOfDate = LocalDate.of(2026, 8, 11);
        LocalDateTime createdAt = LocalDateTime.of(2026, 8, 11, 8, 0);

        when(user.getId()).thenReturn(1L);
        when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));
        when(stressTestRepository
                .findFirstByUserIdAndStatusAndDeletedFalseOrderByCreatedAtDescIdDesc(
                        1L,
                        StressTestStatus.COMPLETED
                )).thenReturn(Optional.of(stressTest));
        when(stressTest.getPublicId()).thenReturn(testId);
        when(stressTest.getScenario()).thenReturn(scenario);
        when(scenario.getCode()).thenReturn("GLOBAL_CRISIS");
        when(scenario.getName()).thenReturn("Küresel Kriz");
        when(stressTest.getAsOfDate()).thenReturn(asOfDate);
        when(stressTest.getPortfolioImpact()).thenReturn(new BigDecimal("-0.08"));
        when(stressTest.getCreatedAt()).thenReturn(createdAt);

        var response = queryService.getLatestHistory(username);

        assertTrue(response.isPresent());
        assertEquals(testId, response.orElseThrow().testId());
        assertEquals("Küresel Kriz", response.orElseThrow().scenarioName());
    }

    @Test
    void shouldThrowUserNotFoundWhenUserDoesNotExist() {
        when(userRepository.findByUsername("unknown"))
                .thenReturn(Optional.empty());

        BaseException exception = assertThrows(
                BaseException.class,
                () -> queryService.getHistory("unknown")
        );

        assertEquals(
                ErrorCode.USER_NOT_FOUND,
                exception.getErrorCode()
        );

        verifyNoInteractions(stressTestRepository);
    }

    @Test
    void shouldSoftDeleteStressTest() {
        String username = "test-user";
        UUID testId = UUID.randomUUID();

        User user = mock(User.class);
        StressTest stressTest = mock(StressTest.class);

        when(user.getId()).thenReturn(1L);

        when(userRepository.findByUsername(username))
                .thenReturn(Optional.of(user));

        when(stressTestRepository.findByPublicIdAndUserIdAndDeletedFalse(
                testId,
                1L
        )).thenReturn(Optional.of(stressTest));

        queryService.deleteStressTest(username, testId);

        verify(stressTest).setDeleted(true);
    }
}
