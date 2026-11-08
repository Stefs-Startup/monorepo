package com.pulse.accountability.ui.components.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.domain.ChatRole
import com.pulse.accountability.domain.ConversationalMessage
import com.pulse.accountability.domain.TriageAction
import com.pulse.accountability.ui.PulseUiState
import com.pulse.accountability.ui.components.MetaBadge
import java.time.LocalDate

/**
 * Pure, decoupled UI model for any swappable Partner Chat implementation.
 */
data class PartnerChatUiModel(
    val activeTask: TaskItemEntity?,
    val badgeText: String,
    val isHabitualDeferral: Boolean,
    val positionLabel: String?,
    val canCycleNext: Boolean,
    val partnerTitle: String,
    val messages: List<ConversationalMessage>,
    val quickReplies: List<QuickReplySpec>
)

data class QuickReplySpec(
    val id: String,
    val label: String,
    val event: PartnerChatEvent
)

sealed interface PartnerChatEvent {
    data class SendMessage(val text: String) : PartnerChatEvent
    data class ExecuteTriage(val task: TaskItemEntity, val action: TriageAction) : PartnerChatEvent
    data object CycleNextTask : PartnerChatEvent
    data object OpenUndoneLog : PartnerChatEvent
    data object Dismiss : PartnerChatEvent
}

/**
 * Pure deterministic mapper that converts [PulseUiState] into a decoupled [PartnerChatUiModel].
 */
object PartnerChatMapper {

    fun fromUiState(
        uiState: PulseUiState,
        today: LocalDate = LocalDate.now()
    ): PartnerChatUiModel {
        val task = uiState.activeConversationTask
        val stalledCount = uiState.stalledStatuses.size
        val isHabitual = (task?.deferCount ?: 0) >= 2
        val badgeText = when {
            task == null -> ""
            task.deferCount > 0 -> "Deferred ${task.deferCount}×"
            else -> "Long-Standing"
        }

        val positionLabel = if (task != null && stalledCount > 1) {
            val idx = uiState.stalledStatuses.indexOfFirst { it.task.id == task.id }
            val displayIdx = if (idx >= 0) idx + 1 else 1
            "$displayIdx of $stalledCount stalled"
        } else {
            null
        }

        val quickReplies = if (task != null) {
            defaultQuickReplies(task, today)
        } else {
            emptyList()
        }

        return PartnerChatUiModel(
            activeTask = task,
            badgeText = badgeText,
            isHabitualDeferral = isHabitual,
            positionLabel = positionLabel,
            canCycleNext = stalledCount > 1,
            partnerTitle = "${uiState.settings.partnerTone.title} Partner",
            messages = uiState.conversationMessages,
            quickReplies = quickReplies
        )
    }

    fun defaultQuickReplies(
        task: TaskItemEntity,
        today: LocalDate = LocalDate.now()
    ): List<QuickReplySpec> = listOf(
        QuickReplySpec(
            id = "shrink_5m",
            label = "Too big — shrink to 5m",
            event = PartnerChatEvent.SendMessage("It feels too big — let's shrink to 5m")
        ),
        QuickReplySpec(
            id = "do_today",
            label = "Do Today",
            event = PartnerChatEvent.ExecuteTriage(task, TriageAction.CommitToday)
        ),
        QuickReplySpec(
            id = "waiting_on",
            label = "Waiting on someone",
            event = PartnerChatEvent.SendMessage("Waiting on someone else before I can start")
        ),
        QuickReplySpec(
            id = "defer_tomorrow",
            label = "Defer to Tomorrow",
            event = PartnerChatEvent.ExecuteTriage(task, TriageAction.Reschedule(today.plusDays(1)))
        ),
        QuickReplySpec(
            id = "let_it_go",
            label = "Let it go",
            event = PartnerChatEvent.SendMessage("Not a priority anymore — let it go")
        )
    )

    fun actionLabelFor(action: TriageAction): String = when (action) {
        is TriageAction.ShrinkTo5m -> "Shrink to 5m & Do Today"
        is TriageAction.CommitToday -> "Do Today"
        is TriageAction.Delegate -> "Mark Waiting-On"
        is TriageAction.DropConsciously -> "Let It Go Consciously"
        is TriageAction.ParkSomeday -> "Park in Someday"
        is TriageAction.Reschedule -> "Defer to Tomorrow"
    }
}

/**
 * Modular, swappable full-viewport Partner Chat overlay routed via the Reflect FAB.
 * Uses reactive [rememberLazyListState] auto-scrolling and IME-aware insets.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PartnerChatOverlay(
    model: PartnerChatUiModel,
    onEvent: (PartnerChatEvent) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Scaffold(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
                .navigationBarsPadding(),
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = "Reflect",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = { onEvent(PartnerChatEvent.Dismiss) }) {
                            Icon(
                                imageVector = Icons.Rounded.Close,
                                contentDescription = "Close reflection chat"
                            )
                        }
                    },
                    actions = {
                        if (model.canCycleNext) {
                            TextButton(onClick = { onEvent(PartnerChatEvent.CycleNextTask) }) {
                                Text("Next task")
                            }
                        } else {
                            TextButton(onClick = { onEvent(PartnerChatEvent.OpenUndoneLog) }) {
                                Text("View log")
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.background,
                        titleContentColor = MaterialTheme.colorScheme.onBackground
                    )
                )
            }
        ) { innerPadding ->
            PartnerChatContent(
                model = model,
                onEvent = onEvent,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            )
        }
    }
}

/**
 * Reusable core chat stream + context header + composer component.
 * Can be embedded in any host container (full-screen overlay, adaptive pane, or sheet).
 */
@Composable
fun PartnerChatContent(
    model: PartnerChatUiModel,
    onEvent: (PartnerChatEvent) -> Unit,
    modifier: Modifier = Modifier
) {
    val activeTask = model.activeTask
    val listState = rememberLazyListState()

    // Reactive auto-scroll whenever a user message or partner reply is appended
    LaunchedEffect(model.messages.size, activeTask?.id) {
        if (model.messages.isNotEmpty()) {
            listState.animateScrollToItem(model.messages.lastIndex)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        if (activeTask == null) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    shape = MaterialTheme.shapes.large,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainerLow
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Text(
                            text = "All Clear right now",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Nothing is stuck in deferral limbo. Sync your Google Tasks or check your Undone Log anytime.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        } else {
            ChatTaskContextCard(model = model, task = activeTask)

            Spacer(modifier = Modifier.height(10.dp))

            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                items(
                    items = model.messages,
                    key = { "${activeTask.id}-${it.id}" }
                ) { msg ->
                    ChatMessageBubble(
                        message = msg,
                        partnerTitle = model.partnerTitle,
                        onExecuteAction = { action ->
                            onEvent(PartnerChatEvent.ExecuteTriage(activeTask, action))
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            ChatComposerSurface(
                quickReplies = model.quickReplies,
                onEvent = onEvent
            )
        }
    }
}

@Composable
private fun ChatTaskContextCard(
    model: PartnerChatUiModel,
    task: TaskItemEntity
) {
    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                MetaBadge(
                    text = model.badgeText,
                    containerColor = if (model.isHabitualDeferral) {
                        MaterialTheme.colorScheme.errorContainer
                    } else {
                        MaterialTheme.colorScheme.secondaryContainer
                    },
                    contentColor = if (model.isHabitualDeferral) {
                        MaterialTheme.colorScheme.onErrorContainer
                    } else {
                        MaterialTheme.colorScheme.onSecondaryContainer
                    }
                )
                model.positionLabel?.let { label ->
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = task.title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

@Composable
private fun ChatMessageBubble(
    message: ConversationalMessage,
    partnerTitle: String,
    onExecuteAction: (TriageAction) -> Unit
) {
    val isPartner = message.role == ChatRole.PARTNER
    AnimatedVisibility(
        visible = true,
        enter = fadeIn() + slideInVertically(initialOffsetY = { it / 4 })
    ) {
        Column(
            horizontalAlignment = if (isPartner) Alignment.Start else Alignment.End,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = if (isPartner) partnerTitle else "You",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            )
            Card(
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(
                    containerColor = if (isPartner) {
                        MaterialTheme.colorScheme.primaryContainer
                    } else {
                        MaterialTheme.colorScheme.secondaryContainer
                    }
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = message.text,
                        style = MaterialTheme.typography.bodyLarge,
                        color = if (isPartner) {
                            MaterialTheme.colorScheme.onPrimaryContainer
                        } else {
                            MaterialTheme.colorScheme.onSecondaryContainer
                        }
                    )
                    val suggested = message.suggestedAction
                    if (isPartner && suggested != null) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { onExecuteAction(suggested) },
                            shape = CircleShape
                        ) {
                            Text(PartnerChatMapper.actionLabelFor(suggested))
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChatComposerSurface(
    quickReplies: List<QuickReplySpec>,
    onEvent: (PartnerChatEvent) -> Unit
) {
    var inputText by rememberSaveable { mutableStateOf("") }

    Surface(
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainerLow,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                quickReplies.forEach { reply ->
                    FilterChip(
                        selected = false,
                        onClick = { onEvent(reply.event) },
                        label = { Text(reply.label) },
                        shape = CircleShape
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    placeholder = { Text("Reply to your partner...") },
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = {
                        if (inputText.isNotBlank()) {
                            onEvent(PartnerChatEvent.SendMessage(inputText))
                            inputText = ""
                        }
                    },
                    enabled = inputText.isNotBlank(),
                    shape = CircleShape
                ) {
                    Text("Send")
                }
            }
        }
    }
}
