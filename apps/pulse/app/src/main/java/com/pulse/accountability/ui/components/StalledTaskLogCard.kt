package com.pulse.accountability.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.domain.AccountabilityCategory
import com.pulse.accountability.domain.TaskAccountabilityStatus

/**
 * Reusable card-with-bubbles component for Habitually Undone & Long-Standing tasks,
 * shared between the Horizon preview list and the Undone Log audit trail.
 */
@Composable
fun StalledTaskLogCard(
    status: TaskAccountabilityStatus,
    onTalkThroughTask: (TaskItemEntity) -> Unit,
    onToggleComplete: (TaskItemEntity) -> Unit,
    containerColor: Color = MaterialTheme.colorScheme.surfaceContainerHigh,
    usePrimaryCta: Boolean = true,
    modifier: Modifier = Modifier
) {
    val isHabitual = status.category == AccountabilityCategory.HABITUALLY_DEFERRED
    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = containerColor),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                MetaBadge(
                    text = status.badgeLabel,
                    containerColor = if (isHabitual) {
                        MaterialTheme.colorScheme.errorContainer
                    } else {
                        MaterialTheme.colorScheme.tertiaryContainer
                    },
                    contentColor = if (isHabitual) {
                        MaterialTheme.colorScheme.onErrorContainer
                    } else {
                        MaterialTheme.colorScheme.onTertiaryContainer
                    }
                )
                MetaBadge(
                    text = if (isHabitual) "Habitually Undone" else "Long-Standing",
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = status.task.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (status.task.blockerNote.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Last reflection: \"${status.task.blockerNote}\"",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            } else if (status.task.notes.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = status.task.notes,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (usePrimaryCta) {
                    Button(
                        onClick = { onTalkThroughTask(status.task) },
                        shape = CircleShape
                    ) {
                        Text("Talk it through")
                    }
                } else {
                    FilledTonalButton(
                        onClick = { onTalkThroughTask(status.task) },
                        shape = CircleShape
                    ) {
                        Text("Talk it through")
                    }
                }
                OutlinedButton(
                    onClick = { onToggleComplete(status.task) },
                    shape = CircleShape
                ) {
                    Text("Done")
                }
            }
        }
    }
}
