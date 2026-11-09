package com.pulse.accountability.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.WbTwilight
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.pulse.accountability.data.local.PrepStep
import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.domain.PartnerBriefing
import com.pulse.accountability.domain.TriageAction
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
fun ExpressivePartnerBriefingCard(
    briefing: PartnerBriefing,
    onActionClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primaryContainer,
                            MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.55f)
                        )
                    )
                )
                .padding(24.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Surface(
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(34.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Rounded.AutoAwesome,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
                Text(
                    text = briefing.headline.uppercase(),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = briefing.message,
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.SemiBold),
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )

            Spacer(modifier = Modifier.height(18.dp))

            Button(
                onClick = onActionClick,
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                )
            ) {
                Icon(
                    imageVector = Icons.Outlined.Bolt,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = briefing.actionHighlight,
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ExpressiveTaskCard(
    task: TaskItemEntity,
    prepSteps: List<PrepStep>,
    onToggleComplete: () -> Unit,
    onToggleTop3: () -> Unit,
    onOpenPrepSheet: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isTop3 = task.commitment == TaskCommitmentState.TODAY_TOP_3
    val containerColor by animateColorAsState(
        targetValue = when {
            task.isCompleted -> MaterialTheme.colorScheme.surfaceContainerLow
            isTop3 -> MaterialTheme.colorScheme.surfaceContainerHigh
            else -> MaterialTheme.colorScheme.surfaceContainer
        },
        animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
        label = "cardColor"
    )

    val checkScale by animateFloatAsState(
        targetValue = if (task.isCompleted) 1.08f else 1.0f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "checkScale"
    )

    val daysOverdue = task.daysOverdue()
    val daysUntil = task.daysUntilDue()
    val completedPrepCount = prepSteps.count { it.isDone }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onOpenPrepSheet() },
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = containerColor),
        border = if (isTop3 && !task.isCompleted) {
            BorderStroke(1.5.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.45f))
        } else null
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Expressive Squircle Check Button
                Surface(
                    onClick = onToggleComplete,
                    shape = RoundedCornerShape(14.dp),
                    color = if (task.isCompleted) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.surfaceContainerHighest
                    },
                    border = if (!task.isCompleted) {
                        BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
                    } else null,
                    modifier = Modifier
                        .size(32.dp)
                        .scale(checkScale)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        if (task.isCompleted) {
                            Icon(
                                imageVector = Icons.Outlined.Check,
                                contentDescription = "Completed",
                                tint = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = task.title,
                        style = MaterialTheme.typography.titleMedium.copy(
                            textDecoration = if (task.isCompleted) TextDecoration.LineThrough else TextDecoration.None,
                            fontWeight = if (isTop3) FontWeight.Bold else FontWeight.SemiBold
                        ),
                        color = if (task.isCompleted) {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        }
                    )

                    if (task.notes.isNotBlank()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = task.notes,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        // Energy pill
                        MetaBadge(
                            text = task.energy.label,
                            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                            contentColor = MaterialTheme.colorScheme.onTertiaryContainer
                        )

                        // Overdue or Due Date pill
                        if (daysOverdue > 0 && !task.isCompleted) {
                            MetaBadge(
                                text = "${daysOverdue}d overdue",
                                containerColor = MaterialTheme.colorScheme.errorContainer,
                                contentColor = MaterialTheme.colorScheme.onErrorContainer
                            )
                        } else if (daysUntil != null && !task.isCompleted) {
                            val dueLabel = when (daysUntil) {
                                0L -> "Due Today"
                                1L -> "Tomorrow"
                                else -> "In ${daysUntil}d"
                            }
                            MetaBadge(
                                text = dueLabel,
                                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }

                        // Defer count badge if postponed
                        if (task.deferCount > 0 && !task.isCompleted) {
                            MetaBadge(
                                text = "Deferred ${task.deferCount}×",
                                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }

                        // Prep steps progress badge
                        if (prepSteps.isNotEmpty()) {
                            MetaBadge(
                                text = "Prep $completedPrepCount/${prepSteps.size}",
                                containerColor = MaterialTheme.colorScheme.primaryContainer,
                                contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }

                if (!task.isCompleted) {
                    FilledTonalIconButton(
                        onClick = onToggleTop3,
                        colors = IconButtonDefaults.filledTonalIconButtonColors(
                            containerColor = if (isTop3) {
                                MaterialTheme.colorScheme.primaryContainer
                            } else {
                                MaterialTheme.colorScheme.surfaceContainerHighest
                            }
                        ),
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = if (isTop3) Icons.Rounded.PushPin else Icons.Outlined.PushPin,
                            contentDescription = "Pin to Today's Top 3",
                            tint = if (isTop3) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LeftUndoneTriageCard(
    task: TaskItemEntity,
    onTriageAction: (TriageAction) -> Unit,
    onOpenPrepSheet: () -> Unit,
    modifier: Modifier = Modifier
) {
    val daysOverdue = task.daysOverdue()
    val daysUntouched = task.daysSinceUpdated()

    val reasonLabel = when {
        daysOverdue > 0 && task.deferCount >= 2 ->
            "Overdue by ${daysOverdue}d • Deferred ${task.deferCount} times"
        daysOverdue > 0 ->
            "Left undone from ${daysOverdue}d ago"
        task.deferCount >= 2 ->
            "Postponed ${task.deferCount} times — needs a smaller first step"
        else ->
            "Forgotten in '${task.taskListTitle}' (${daysUntouched}d untouched)"
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.65f)
        )
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Outlined.History,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = reasonLabel,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.secondary
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = task.title,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )

            if (task.blockerNote.isNotBlank() || task.notes.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (task.blockerNote.isNotBlank()) "Blocker: ${task.blockerNote}" else task.notes,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.8f)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onTriageAction(TriageAction.CommitToday) },
                    shape = CircleShape
                ) {
                    Text("Commit Today")
                }

                FilledTonalButton(
                    onClick = { onTriageAction(TriageAction.ShrinkTo5m) },
                    shape = CircleShape
                ) {
                    Text("Shrink to 5m")
                }

                FilledTonalButton(
                    onClick = onOpenPrepSheet,
                    shape = CircleShape
                ) {
                    Icon(
                        imageVector = Icons.Outlined.AutoAwesome,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Prep Steps")
                }

                OutlinedButton(
                    onClick = { onTriageAction(TriageAction.Reschedule(LocalDate.now().plusDays(1))) },
                    shape = CircleShape
                ) {
                    Text("Tomorrow")
                }

                OutlinedButton(
                    onClick = { onTriageAction(TriageAction.Delegate("Waiting on external input")) },
                    shape = CircleShape
                ) {
                    Text("Waiting On")
                }

                OutlinedButton(
                    onClick = { onTriageAction(TriageAction.ParkSomeday) },
                    shape = CircleShape
                ) {
                    Text("Someday")
                }

                OutlinedButton(
                    onClick = { onTriageAction(TriageAction.DropConsciously) },
                    shape = CircleShape
                ) {
                    Text("Drop")
                }
            }
        }
    }
}

@Composable
fun MetaBadge(
    text: String,
    containerColor: androidx.compose.ui.graphics.Color,
    contentColor: androidx.compose.ui.graphics.Color
) {
    Surface(
        shape = CircleShape,
        color = containerColor,
        contentColor = contentColor
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}
