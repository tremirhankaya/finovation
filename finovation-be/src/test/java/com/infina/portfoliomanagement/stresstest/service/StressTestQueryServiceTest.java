package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.repository.StressTestPositionSnapshotRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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