package com.pulse.accountability.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pulse.accountability.data.local.PartnerTone
import com.pulse.accountability.data.local.PrepStep
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.ui.PulseUiState
import com.pulse.accountability.ui.components.AccountabilityHorizonSection
import com.pulse.accountability.ui.components.ExpressiveTaskCard
import com.pulse.accountability.ui.components.StalledTaskLogCard
import com.pulse.accountability.ui.screens.settings.PartnerSettingsNavigator

@Composable
fun InteractiveHorizonHomeScreen(
    uiState: PulseUiState,
    onSelectTaskById: (String) -> Unit,
    onTalkThroughTask: (TaskItemEntity) -> Unit,
    onToggleComplete: (TaskItemEntity) -> Unit,
    onOpenFullLog: () -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            AccountabilityHorizonSection(
                snapshot = uiState.horizonSnapshot,
                selectedTask = uiState.activeConversationTask,
                onSelectTaskById = onSelectTaskById,
                onReflectOnTask = onTalkThroughTask,
                onMarkTaskDone = onToggleComplete
            )
        }

        item { Spacer(modifier = Modifier.height(88.dp)) }
    }
}

@Composable
fun MlpAccountabilityRadarScreen(
    uiState: PulseUiState,
    decodePrepSteps: (TaskItemEntity) -> List<PrepStep>,
    onTalkThroughTask: (TaskItemEntity) -> Unit,
    onToggleComplete: (TaskItemEntity) -> Unit,
    onToggleTop3: (TaskItemEntity) -> Unit,
    onOpenTaskPrep: (TaskItemEntity) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Section 1: Habitually Undone & Long-Standing Log
        item {
            SectionHeader(
                title = "Habitually Undone & Long-Standing (${uiState.stalledStatuses.size})",
                subtitle = "Repeatedly deferred (2+ times), overdue, or untouched for 5+ days"
            )
        }

        if (uiState.stalledStatuses.isEmpty()) {
            item {
                EmptyStageCard(
                    title = "No Habitually Undone Tasks",
                    body = "Nothing is lingering or ghosted. When tasks slip across multiple days, they'll surface here for honest reflection."
                )
            }
        } else {
            items(uiState.stalledStatuses, key = { "stalled-${it.task.id}" }) { status ->
                StalledTaskLogCard(
                    status = status,
                    onTalkThroughTask = onTalkThroughTask,
                    onToggleComplete = onToggleComplete
                )
            }
        }

        // Section 2: Today's Committed (Top 3)
        item {
            Spacer(modifier = Modifier.height(4.dp))
            SectionHeader(
                title = "Committed Today (${uiState.todayTop3Tasks.size}/3)",
                subtitle = "Your protected daily finish line"
            )
        }

        if (uiState.todayTop3Tasks.isEmpty()) {
            item {
                EmptyStageCard(
                    title = "No Tasks Locked in for Today",
                    body = "Talk through a stalled task above or pin up to 3 active commitments."
                )
            }
        } else {
            items(uiState.todayTop3Tasks, key = { "mlp-top3-${it.id}" }) { task ->
                ExpressiveTaskCard(
                    task = task,
                    prepSteps = decodePrepSteps(task),
                    onToggleComplete = { onToggleComplete(task) },
                    onToggleTop3 = { onToggleTop3(task) },
                    onOpenPrepSheet = { onTalkThroughTask(task) }
                )
            }
        }

        // Section 3: Other Active Tasks
        if (uiState.activeOtherTasks.isNotEmpty()) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
                SectionHeader(
                    title = "Active Backlog (${uiState.activeOtherTasks.size})",
                    subtitle = "Recent tasks not yet stalling"
                )
            }
            items(uiState.activeOtherTasks, key = { "mlp-other-${it.id}" }) { task ->
                ExpressiveTaskCard(
                    task = task,
                    prepSteps = decodePrepSteps(task),
                    onToggleComplete = { onToggleComplete(task) },
                    onToggleTop3 = { onToggleTop3(task) },
                    onOpenPrepSheet = { onOpenTaskPrep(task) }
                )
            }
        }

        item { Spacer(modifier = Modifier.height(88.dp)) }
    }
}

@Composable
fun PartnerSettingsScreen(
    uiState: PulseUiState,
    onLaunchGoogleSignIn: () -> Unit,
    onSignOutGoogle: () -> Unit,
    onTriggerGoogleSync: () -> Unit,
    onSaveGeminiKey: (String) -> Unit,
    onSelectPartnerTone: (PartnerTone) -> Unit,
    onToggleDynamicColors: (Boolean) -> Unit,
    onResetDemoData: () -> Unit,
    onRestartOnboarding: () -> Unit,
    onSendTestSignal: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    PartnerSettingsNavigator(
        uiState = uiState,
        onLaunchGoogleSignIn = onLaunchGoogleSignIn,
        onSignOutGoogle = onSignOutGoogle,
        onTriggerGoogleSync = onTriggerGoogleSync,
        onSaveGeminiKey = onSaveGeminiKey,
        onSelectPartnerTone = onSelectPartnerTone,
        onToggleDynamicColors = onToggleDynamicColors,
        onResetDemoData = onResetDemoData,
        onRestartOnboarding = onRestartOnboarding,
        onSendTestSignal = onSendTestSignal,
        modifier = modifier
    )
}

@Composable
private fun SectionHeader(
    title: String,
    subtitle: String
) {
    Column {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun EmptyStageCard(
    title: String,
    body: String
) {
    Surface(
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
