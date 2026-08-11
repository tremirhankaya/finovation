package com.infina.portfoliomanagement.dashboard.controller;

import com.infina.portfoliomanagement.dashboard.dto.DashboardSummaryResponse;
import com.infina.portfoliomanagement.dashboard.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardControllerTest {

    @Mock
    private DashboardService dashboardService;

    @Mock
    private UserDetails userDetails;

    @InjectMocks
    private DashboardController controller;

    @Test
    void getSummary_delegatesWithAuthenticatedUsername() {
        DashboardSummaryResponse summary = new DashboardSummaryResponse(
                LocalDate.of(2026, 8, 11),
                List.of(),
                0,
                List.of(),
                List.of(),
                null,
                List.of(),
                List.of()
        );
        when(userDetails.getUsername()).thenReturn("dashboard-user");
        when(dashboardService.getSummary("dashboard-user")).thenReturn(summary);

        DashboardSummaryResponse response = controller.getSummary(userDetails);

        assertThat(response).isSameAs(summary);
        verify(dashboardService).getSummary("dashboard-user");
    }
}
