package com.pulse.accountability.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChatBubble
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Swipe
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.domain.AccountabilityCategory
import com.pulse.accountability.domain.HorizonWindowBarItem
import com.pulse.accountability.domain.HorizonWindowCardModel
import com.pulse.accountability.domain.HorizonWindowType
import com.pulse.accountability.domain.TaskHorizonAnalyticsSnapshot
import com.pulse.accountability.domain.TaskVisualNode
import com.pulse.accountability.observability.PulseObservability
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AccountabilityHorizonSection(
    snapshot: TaskHorizonAnalyticsSnapshot,
    selectedTask: TaskItemEntity?,
    onSelectTaskById: (String) -> Unit,
    onReflectOnTask: (TaskItemEntity) -> Unit,
    onMarkTaskDone: (TaskItemEntity) -> Unit,
    modifier: Modifier = Modifier
) {
    val windows = snapshot.windows
    val pagerState = rememberPagerState(
        initialPage = 0,
        pageCount = { windows.size.coerceAtLeast(1) }
    )
    val coroutineScope = rememberCoroutineScope()

    val selectedNode = snapshot.nodes.find { it.taskId == selectedTask?.id }
        ?: snapshot.nodes.firstOrNull()

    // Reactive sync: when swiping to a new window card, focus the #1 task of that window
    LaunchedEffect(pagerState.currentPage) {
        val currentWindow = windows.getOrNull(pagerState.currentPage) ?: return@LaunchedEffect
        if (currentWindow.items.isNotEmpty() && currentWindow.items.none { it.taskId == selectedTask?.id }) {
            onSelectTaskById(currentWindow.items.first().taskId)
        }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Window Selector Pills + Swipeable Horizon Carousel
        if (windows.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                windows.forEachIndexed { idx, window ->
                    val isCurrent = pagerState.currentPage == idx
                    FilterChip(
                        selected = isCurrent,
                        onClick = {
                            PulseObservability.recordBreadcrumb(
                                event = "horizon_window_tab_selected",
                                attributes = mapOf("window" to window.windowType.name)
                            )
                            coroutineScope.launch { pagerState.animateScrollToPage(idx) }
                        },
                        label = {
                            Text(
                                text = window.shortTabTitle,
                                style = MaterialTheme.typography.labelLarge,
                                maxLines = 1
                            )
                        },
                        shape = CircleShape
                    )
                }
            }

            HorizontalPager(
                state = pagerState,
                contentPadding = PaddingValues(end = 12.dp),
                pageSpacing = 12.dp,
                modifier = Modifier.fillMaxWidth()
            ) { pageIndex ->
                val windowModel = windows[pageIndex]
                HorizonWindowCarouselCard(
                    window = windowModel,
                    selectedTaskId = selectedNode?.taskId,
                    onSelectTaskById = onSelectTaskById,
                    pageIndex = pageIndex,
                    totalPages = windows.size
                )
            }

            // Carousel Page Indicator Dots
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                windows.forEachIndexed { idx, _ ->
                    val isCurrent = pagerState.currentPage == idx
                    val dotWidth by animateFloatAsState(
                        targetValue = if (isCurrent) 24f else 8f,
                        animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
                        label = "carouselDotWidth"
                    )
                    Box(
                        modifier = Modifier
                            .padding(horizontal = 4.dp)
                            .height(8.dp)
                            .width(dotWidth.dp)
                            .clip(CircleShape)
                            .background(
                                if (isCurrent) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.28f)
                                }
                            )
                    )
                }
            }
        }

        // 3. Live Selected Task Analytical Inspector Card
        if (selectedTask != null && selectedNode != null) {
            SelectedNodeInspectorCard(
                task = selectedTask,
                node = selectedNode,
                onReflect = { onReflectOnTask(selectedTask) },
                onMarkDone = { onMarkTaskDone(selectedTask) }
            )
        }
    }
}

@Composable
private fun HorizonWindowCarouselCard(
    window: HorizonWindowCardModel,
    selectedTaskId: String?,
    onSelectTaskById: (String) -> Unit,
    pageIndex: Int,
    totalPages: Int
) {
    val accentContainer = when (window.windowType) {
        HorizonWindowType.HABITUALLY_UNDONE -> MaterialTheme.colorScheme.errorContainer
        HorizonWindowType.LONG_STANDING_DRIFT -> MaterialTheme.colorScheme.tertiaryContainer
        HorizonWindowType.ACTIVE_FLOW -> MaterialTheme.colorScheme.primaryContainer
    }
    val accentContent = when (window.windowType) {
        HorizonWindowType.HABITUALLY_UNDONE -> MaterialTheme.colorScheme.onErrorContainer
        HorizonWindowType.LONG_STANDING_DRIFT -> MaterialTheme.colorScheme.onTertiaryContainer
        HorizonWindowType.ACTIVE_FLOW -> MaterialTheme.colorScheme.onPrimaryContainer
    }
    val accentBorder = when (window.windowType) {
        HorizonWindowType.HABITUALLY_UNDONE -> MaterialTheme.colorScheme.error
        HorizonWindowType.LONG_STANDING_DRIFT -> MaterialTheme.colorScheme.tertiary
        HorizonWindowType.ACTIVE_FLOW -> MaterialTheme.colorScheme.primary
    }

    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            // Card Header: Window Title + Headline Stat Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "WINDOW ${pageIndex + 1} OF $totalPages",
                            style = MaterialTheme.typography.labelLarge.copy(fontSize = 11.sp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Icon(
                            imageVector = Icons.Rounded.Swipe,
                            contentDescription = "Swipeable window carousel",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = window.title,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = window.subtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                MetaBadge(
                    text = window.headlineStat,
                    containerColor = accentContainer,
                    contentColor = accentContent
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            if (window.items.isEmpty()) {
                Surface(
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Text(
                            text = window.emptyStateTitle,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = window.emptyStateBody,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                // Descending Analytical Bar Cascade (up to 6 visible rows per window card)
                Column(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    window.items.take(6).forEachIndexed { rankIndex, item ->
                        val isSelected = item.taskId == selectedTaskId
                        DescendingHorizonBarRow(
                            rank = rankIndex + 1,
                            item = item,
                            isSelected = isSelected,
                            barFillColor = accentContainer,
                            barContentColor = accentContent,
                            barAccentBorder = accentBorder,
                            onClick = { onSelectTaskById(item.taskId) }
                        )
                    }
                    if (window.items.size > 6) {
                        Text(
                            text = "+${window.items.size - 6} more in descending order (see Full Log)",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DescendingHorizonBarRow(
    rank: Int,
    item: HorizonWindowBarItem,
    isSelected: Boolean,
    barFillColor: Color,
    barContentColor: Color,
    barAccentBorder: Color,
    onClick: () -> Unit
) {
    val animatedFraction by animateFloatAsState(
        targetValue = item.intensityFraction.coerceIn(0.28f, 1.0f),
        animationSpec = spring(stiffness = Spring.StiffnessLow),
        label = "barFraction"
    )
    val borderColor by animateColorAsState(
        targetValue = if (isSelected) barAccentBorder else Color.Transparent,
        label = "barBorder"
    )

    Surface(
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .border(
                width = if (isSelected) 2.dp else 0.dp,
                color = borderColor,
                shape = MaterialTheme.shapes.medium
            )
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "#$rank",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                Text(
                    text = item.secondaryMetricLabel,
                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Calming Proportional Analytical Bar Track
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(28.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest.copy(alpha = 0.55f))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(animatedFraction)
                        .height(28.dp)
                        .clip(CircleShape)
                        .background(barFillColor)
                        .padding(horizontal = 12.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = item.primaryMetricLabel,
                            style = MaterialTheme.typography.labelLarge.copy(fontSize = 12.sp),
                            fontWeight = FontWeight.Bold,
                            color = barContentColor
                        )
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(barAccentBorder)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AnalyticalMetricTile(
    value: String,
    label: String,
    sublabel: String,
    isSelected: Boolean,
    containerColor: Color,
    contentColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = MaterialTheme.shapes.medium,
        color = containerColor,
        modifier = modifier
            .clip(MaterialTheme.shapes.medium)
            .border(
                width = if (isSelected) 2.dp else 0.dp,
                color = if (isSelected) contentColor else Color.Transparent,
                shape = MaterialTheme.shapes.medium
            )
            .clickable(onClick = onClick)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp)
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = contentColor
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = contentColor
            )
            Text(
                text = sublabel,
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 11.sp, lineHeight = 14.sp),
                color = contentColor
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SelectedNodeInspectorCard(
    task: TaskItemEntity,
    node: TaskVisualNode,
    onReflect: () -> Unit,
    onMarkDone: () -> Unit
) {
    val isHabitual = node.category == AccountabilityCategory.HABITUALLY_DEFERRED
    val isLongStanding = node.category == AccountabilityCategory.LONG_STANDING_GHOSTED

    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    MetaBadge(
                        text = when {
                            isHabitual -> "Habitually Undone"
                            isLongStanding -> "Long-Standing"
                            node.category == AccountabilityCategory.ACTIVE_COMMITTED -> "Committed Top 3"
                            else -> "Active"
                        },
                        containerColor = when {
                            isHabitual -> MaterialTheme.colorScheme.errorContainer
                            isLongStanding -> MaterialTheme.colorScheme.tertiaryContainer
                            else -> MaterialTheme.colorScheme.primaryContainer
                        },
                        contentColor = when {
                            isHabitual -> MaterialTheme.colorScheme.onErrorContainer
                            isLongStanding -> MaterialTheme.colorScheme.onTertiaryContainer
                            else -> MaterialTheme.colorScheme.onPrimaryContainer
                        }
                    )
                    MetaBadge(
                        text = "Deferrals: ${node.deferCount}×",
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    MetaBadge(
                        text = "Age: ${node.daysOld}d • Idle: ${node.daysUntouched}d",
                        containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
                        contentColor = MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = task.title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (task.blockerNote.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Last reflection: \"${task.blockerNote}\"",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            } else if (task.notes.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = task.notes,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = onReflect,
                    shape = CircleShape
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ChatBubble,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Reflect with Partner")
                }

                OutlinedButton(
                    onClick = onMarkDone,
                    shape = CircleShape
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Check,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Done")
                }
            }
        }
    }
}
