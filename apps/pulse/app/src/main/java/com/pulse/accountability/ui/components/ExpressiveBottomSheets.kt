package com.pulse.accountability.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.pulse.accountability.data.local.PrepStep
import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.data.local.WeeklyGoalEntity
import com.pulse.accountability.data.repository.TriageDecision
import com.pulse.accountability.domain.ChatRole
import com.pulse.accountability.domain.ConversationalMessage
import com.pulse.accountability.domain.TriageAction
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun TaskPreparationSheet(
    task: TaskItemEntity,
    prepSteps: List<PrepStep>,
    coachingNote: String?,
    isGenerating: Boolean,
    onDismiss: () -> Unit,
    onGeneratePartnerPrep: () -> Unit,
    onTogglePrepStep: (String) -> Unit,
    onAddCustomPrepStep: (String) -> Unit,
    onToggleTodayTop3: () -> Unit,
    onTriageDecision: (TriageDecision) -> Unit,
    onCompleteTask: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var newStepText by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = MaterialTheme.shapes.extraLarge,
        containerColor = MaterialTheme.colorScheme.surfaceContainerLow
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .navigationBarsPadding()
                .padding(bottom = 28.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                MetaBadge(
                    text = task.taskListTitle,
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                )
                MetaBadge(
                    text = task.energy.label,
                    containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                    contentColor = MaterialTheme.colorScheme.onTertiaryContainer
                )
                if (task.deferCount > 0) {
                    MetaBadge(
                        text = "Deferred ${task.deferCount}×",
                        containerColor = MaterialTheme.colorScheme.errorContainer,
                        contentColor = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = task.title,
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (task.notes.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = task.notes,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Partner Preparation & Breakdown Header
            Card(
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.AutoAwesome,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Text(
                                text = "Preparation & First Steps",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }

                        Button(
                            onClick = onGeneratePartnerPrep,
                            enabled = !isGenerating,
                            shape = CircleShape
                        ) {
                            if (isGenerating) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Thinking...")
                            } else {
                                Text(if (prepSteps.isEmpty()) "Generate Plan" else "Refresh Plan")
                            }
                        }
                    }

                    if (!coachingNote.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = coachingNote,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    } else if (prepSteps.isEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Feeling stuck or need to prepare ahead? Tap 'Generate Plan' and your partner will break this into concrete micro-steps.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Checklist Items
            prepSteps.forEach { step ->
                Surface(
                    onClick = { onTogglePrepStep(step.id) },
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.surfaceContainerHigh,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = if (step.isDone) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                            contentDescription = null,
                            tint = if (step.isDone) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = step.title,
                            style = MaterialTheme.typography.bodyLarge.copy(
                                textDecoration = if (step.isDone) TextDecoration.LineThrough else TextDecoration.None
                            ),
                            color = if (step.isDone) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Add custom prep step
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = newStepText,
                    onValueChange = { newStepText = it },
                    placeholder = { Text("Add a preparation step...") },
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.weight(1f)
                )
                IconButton(
                    onClick = {
                        if (newStepText.isNotBlank()) {
                            onAddCustomPrepStep(newStepText)
                            newStepText = ""
                        }
                    }
                ) {
                    Icon(Icons.Outlined.Add, contentDescription = "Add step")
                }
            }

            Spacer(modifier = Modifier.height(22.dp))

            Text(
                text = "Quick Accountability Actions",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(10.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = {
                        onCompleteTask()
                        onDismiss()
                    },
                    shape = CircleShape
                ) {
                    Text(if (task.isCompleted) "Mark Incomplete" else "Mark Complete")
                }

                OutlinedButton(
                    onClick = {
                        onToggleTodayTop3()
                        onDismiss()
                    },
                    shape = CircleShape
                ) {
                    val isTop = task.commitment == TaskCommitmentState.TODAY_TOP_3
                    Text(if (isTop) "Remove from Top 3" else "Pin to Today's Top 3")
                }

                OutlinedButton(
                    onClick = {
                        onTriageDecision(TriageDecision.RESCHEDULE_TOMORROW)
                        onDismiss()
                    },
                    shape = CircleShape
                ) {
                    Text("Defer to Tomorrow")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AddTaskBottomSheet(
    goals: List<WeeklyGoalEntity>,
    onDismiss: () -> Unit,
    onSaveTask: (
        title: String,
        notes: String,
        energy: TaskEnergyLevel,
        commitToTodayTop3: Boolean,
        dueDaysFromNow: Long?,
        linkedGoalId: String?
    ) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var title by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var selectedEnergy by remember { mutableStateOf(TaskEnergyLevel.FOCUSED) }
    var commitTop3 by remember { mutableStateOf(true) }
    var selectedDueDays by remember { mutableStateOf<Long?>(0L) }
    var selectedGoalId by remember { mutableStateOf<String?>(goals.firstOrNull()?.id) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = MaterialTheme.shapes.extraLarge
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .navigationBarsPadding()
                .padding(bottom = 28.dp)
        ) {
            Text(
                text = "New Commitment",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Capture with intention—choose energy level and when you'll prepare.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("What needs to get done?") },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Preparation notes or context (optional)") },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Energy & Effort Required",
                style = MaterialTheme.typography.labelLarge
            )
            Spacer(modifier = Modifier.height(8.dp))

            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TaskEnergyLevel.entries.forEach { level ->
                    FilterChip(
                        selected = selectedEnergy == level,
                        onClick = { selectedEnergy = level },
                        label = { Text(level.label) },
                        shape = CircleShape
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "Target Timing",
                style = MaterialTheme.typography.labelLarge
            )
            Spacer(modifier = Modifier.height(8.dp))

            val timingOptions = listOf(
                0L to "Today",
                1L to "Tomorrow",
                3L to "In 3 Days (Prep)",
                null to "No Due Date"
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                timingOptions.forEach { (days, label) ->
                    FilterChip(
                        selected = selectedDueDays == days,
                        onClick = { selectedDueDays = days },
                        label = { Text(label) },
                        shape = CircleShape
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Lock into Today's Top 3",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "Make this a non-negotiable priority for today",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = commitTop3,
                    onCheckedChange = { commitTop3 = it }
                )
            }

            Spacer(modifier = Modifier.height(22.dp))

            Button(
                onClick = {
                    if (title.isNotBlank()) {
                        onSaveTask(
                            title,
                            notes,
                            selectedEnergy,
                            commitTop3,
                            selectedDueDays,
                            selectedGoalId
                        )
                        onDismiss()
                    }
                },
                enabled = title.isNotBlank(),
                shape = CircleShape,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Commit to Google Tasks")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun GuidedReflectionModalSheet(
    ritualTitle: String,
    ritualType: String,
    undoneTasksCount: Int,
    completedTasksCount: Int,
    onDismiss: () -> Unit,
    onSubmit: (
        type: String,
        moodScore: Int,
        winHighlight: String,
        leftUndoneReflection: String,
        tomorrowPrepNote: String
    ) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var moodScore by remember { mutableIntStateOf(4) }
    var winHighlight by remember { mutableStateOf("") }
    var undoneReflection by remember { mutableStateOf("") }
    var tomorrowPrep by remember { mutableStateOf("") }

    val moodLabels = listOf(
        1 to "Drained",
        2 to "Scattered",
        3 to "Steady",
        4 to "Focused",
        5 to "In Flow"
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = MaterialTheme.shapes.extraLarge
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .navigationBarsPadding()
                .padding(bottom = 28.dp)
        ) {
            Text(
                text = ritualTitle,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Completed $completedTasksCount task(s) • $undoneTasksCount item(s) still open for honest review.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = "1. How is your energy & focus right now?",
                style = MaterialTheme.typography.titleMedium
            )
            Spacer(modifier = Modifier.height(8.dp))

            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                moodLabels.forEach { (score, label) ->
                    FilterChip(
                        selected = moodScore == score,
                        onClick = { moodScore = score },
                        label = { Text("$score • $label") },
                        shape = CircleShape
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = winHighlight,
                onValueChange = { winHighlight = it },
                label = { Text("2. What went well or moved forward today/this week?") },
                placeholder = { Text("Even a small 5-minute step counts...") },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(14.dp))

            OutlinedTextField(
                value = undoneReflection,
                onValueChange = { undoneReflection = it },
                label = { Text("3. What was left undone or avoided—and why?") },
                placeholder = { Text("Was it too big, unclear, or waiting on someone?") },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(14.dp))

            OutlinedTextField(
                value = tomorrowPrep,
                onValueChange = { tomorrowPrep = it },
                label = { Text("4. What 1 thing should we prepare ahead for tomorrow?") },
                placeholder = { Text("Set out materials, block 20m before checking messages...") },
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(22.dp))

            Button(
                onClick = {
                    onSubmit(
                        ritualType,
                        moodScore,
                        winHighlight.ifBlank { "Showed up to reflect honestly." },
                        undoneReflection.ifBlank { "Acknowledged open loops without guilt." },
                        tomorrowPrep.ifBlank { "Protect the first 25 minutes tomorrow." }
                    )
                    onDismiss()
                },
                shape = CircleShape,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Complete Reflection & Close Loop")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Top3SwapBottomSheet(
    candidateTask: TaskItemEntity,
    currentTop3: List<TaskItemEntity>,
    onDismiss: () -> Unit,
    onSwap: (toRemove: TaskItemEntity, toAdd: TaskItemEntity) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = MaterialTheme.shapes.extraLarge,
        containerColor = MaterialTheme.colorScheme.surfaceContainerLow
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .navigationBarsPadding()
                .padding(bottom = 28.dp)
        ) {
            MetaBadge(
                text = "Finish Line Protected",
                containerColor = MaterialTheme.colorScheme.errorContainer,
                contentColor = MaterialTheme.colorScheme.onErrorContainer
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Your Top 3 is Locked",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "To protect your focus, Pulse allows at most 3 non-negotiables per day. Tap the commitment you want to swap out for \"${candidateTask.title}\":",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(18.dp))

            currentTop3.forEach { existing ->
                Card(
                    onClick = {
                        onSwap(existing, candidateTask)
                        onDismiss()
                    },
                    shape = MaterialTheme.shapes.medium,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = existing.title,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            if (existing.notes.isNotBlank()) {
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = existing.notes,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1
                                )
                            }
                        }
                        Button(
                            onClick = {
                                onSwap(existing, candidateTask)
                                onDismiss()
                            },
                            shape = CircleShape
                        ) {
                            Text("Swap Out")
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            OutlinedButton(
                onClick = onDismiss,
                shape = CircleShape,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Keep Current Top 3")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ConversationalReflectionSheet(
    task: TaskItemEntity,
    messages: List<ConversationalMessage>,
    onSendMessage: (String) -> Unit,
    onExecuteAction: (TriageAction) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var inputText by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = MaterialTheme.shapes.extraLarge,
        containerColor = MaterialTheme.colorScheme.surfaceContainerLow
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .navigationBarsPadding()
                .padding(bottom = 28.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                MetaBadge(
                    text = "Partner Reflection",
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
                if (task.deferCount > 0) {
                    MetaBadge(
                        text = "Deferred ${task.deferCount}×",
                        containerColor = MaterialTheme.colorScheme.errorContainer,
                        contentColor = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = task.title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Barebones Conversational Stream
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                messages.forEach { msg ->
                    val isPartner = msg.role == ChatRole.PARTNER
                    Column(
                        horizontalAlignment = if (isPartner) Alignment.Start else Alignment.End,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = if (isPartner) "Partner" else "You",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                        Card(
                            shape = MaterialTheme.shapes.large,
                            colors = CardDefaults.cardColors(
                                containerColor = if (isPartner) {
                                    MaterialTheme.colorScheme.secondaryContainer
                                } else {
                                    MaterialTheme.colorScheme.primary
                                }
                            )
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = msg.text,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (isPartner) {
                                        MaterialTheme.colorScheme.onSecondaryContainer
                                    } else {
                                        MaterialTheme.colorScheme.onPrimary
                                    }
                                )
                                val suggested = msg.suggestedAction
                                if (isPartner && suggested != null) {
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Button(
                                        onClick = {
                                            onExecuteAction(suggested)
                                            onDismiss()
                                        },
                                        shape = CircleShape
                                    ) {
                                        val actionLabel = when (suggested) {
                                            is TriageAction.ShrinkTo5m -> "Shrink to 5m & Commit Today"
                                            is TriageAction.CommitToday -> "Lock into Today's Top 3"
                                            is TriageAction.Delegate -> "Save Waiting-On Note"
                                            is TriageAction.DropConsciously -> "Let It Go Consciously"
                                            is TriageAction.ParkSomeday -> "Park in Someday"
                                            is TriageAction.Reschedule -> "Reschedule for Tomorrow"
                                        }
                                        Text(actionLabel)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = "Quick Replies & Resolutions",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = false,
                    onClick = { onSendMessage("It feels too big — let's shrink to 5m") },
                    label = { Text("Too big — shrink to 5m") },
                    shape = CircleShape
                )
                FilterChip(
                    selected = false,
                    onClick = {
                        onExecuteAction(TriageAction.CommitToday)
                        onDismiss()
                    },
                    label = { Text("Do Today") },
                    shape = CircleShape
                )
                FilterChip(
                    selected = false,
                    onClick = { onSendMessage("Waiting on someone else before I can start") },
                    label = { Text("Waiting on someone") },
                    shape = CircleShape
                )
                FilterChip(
                    selected = false,
                    onClick = {
                        onExecuteAction(TriageAction.Reschedule(LocalDate.now().plusDays(1)))
                        onDismiss()
                    },
                    label = { Text("Defer to Tomorrow") },
                    shape = CircleShape
                )
                FilterChip(
                    selected = false,
                    onClick = { onSendMessage("Not a priority anymore — let it go") },
                    label = { Text("Let it go") },
                    shape = CircleShape
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Free-text reflection input
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    placeholder = { Text("Type why it's stalled...") },
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = {
                        if (inputText.isNotBlank()) {
                            onSendMessage(inputText)
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
