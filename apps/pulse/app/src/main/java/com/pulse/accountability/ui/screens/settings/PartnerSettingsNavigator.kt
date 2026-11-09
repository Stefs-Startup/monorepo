package com.pulse.accountability.ui.screens.settings

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.BugReport
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudSync
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.RecordVoiceOver
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.pulse.accountability.data.local.PartnerTone
import com.pulse.accountability.observability.PulseObservability
import com.pulse.accountability.ui.PulseUiState
import com.pulse.accountability.ui.components.MetaBadge

enum class SettingsSubPage(val title: String) {
    INDEX("Settings"),
    PERSONALITY("Partner Personality"),
    GOOGLE_SYNC("Google Account & Sync"),
    APPEARANCE_AND_AI("Appearance & AI"),
    DIAGNOSTICS("Diagnostics & Demo")
}

@Composable
fun PartnerSettingsNavigator(
    uiState: PulseUiState,
    onLaunchGoogleSignIn: () -> Unit,
    onSignOutGoogle: () -> Unit,
    onTriggerGoogleSync: () -> Unit,
    onSaveGeminiKey: (String) -> Unit,
    onSelectPartnerTone: (PartnerTone) -> Unit,
    onToggleDynamicColors: (Boolean) -> Unit,
    onResetDemoData: () -> Unit,
    onRestartOnboarding: () -> Unit,
    onSendTestSignal: () -> Unit,
    modifier: Modifier = Modifier
) {
    var currentPage by rememberSaveable { mutableStateOf(SettingsSubPage.INDEX) }

    if (currentPage != SettingsSubPage.INDEX) {
        BackHandler { currentPage = SettingsSubPage.INDEX }
    }

    AnimatedContent(
        targetState = currentPage,
        modifier = modifier.fillMaxSize(),
        label = "settingsSubPageTransition"
    ) { page ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (page != SettingsSubPage.INDEX) {
                SettingsSubPageHeader(
                    title = page.title,
                    onBack = { currentPage = SettingsSubPage.INDEX }
                )
            }

            when (page) {
                SettingsSubPage.INDEX -> SettingsIndexPage(
                    uiState = uiState,
                    onOpenSubPage = { target ->
                        PulseObservability.recordBreadcrumb(
                            event = "settings_subpage_opened",
                            attributes = mapOf("page" to target.name)
                        )
                        currentPage = target
                    }
                )

                SettingsSubPage.PERSONALITY -> PersonalitySubPage(
                    selectedTone = uiState.settings.partnerTone,
                    onSelectPartnerTone = onSelectPartnerTone
                )

                SettingsSubPage.GOOGLE_SYNC -> GoogleSyncSubPage(
                    uiState = uiState,
                    onLaunchGoogleSignIn = onLaunchGoogleSignIn,
                    onTriggerGoogleSync = onTriggerGoogleSync,
                    onSignOutGoogle = onSignOutGoogle
                )

                SettingsSubPage.APPEARANCE_AND_AI -> AppearanceAndAiSubPage(
                    uiState = uiState,
                    onToggleDynamicColors = onToggleDynamicColors,
                    onSaveGeminiKey = onSaveGeminiKey
                )

                SettingsSubPage.DIAGNOSTICS -> DiagnosticsSubPage(
                    onSendTestSignal = onSendTestSignal,
                    onRestartOnboarding = onRestartOnboarding,
                    onResetDemoData = onResetDemoData
                )
            }
        }
    }
}

@Composable
private fun SettingsSubPageHeader(
    title: String,
    onBack: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                contentDescription = "Back to Settings"
            )
        }
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun SettingsIndexPage(
    uiState: PulseUiState,
    onOpenSubPage: (SettingsSubPage) -> Unit
) {
    val isGoogleConnected = uiState.settings.googleAccountEmail.isNotBlank()

    SettingsCategoryNavCard(
        icon = Icons.Outlined.RecordVoiceOver,
        title = "Partner Personality",
        subtitle = uiState.settings.partnerTone.title,
        badgeText = null,
        onClick = { onOpenSubPage(SettingsSubPage.PERSONALITY) }
    )

    SettingsCategoryNavCard(
        icon = Icons.Outlined.CloudSync,
        title = "Google Account & Sync",
        subtitle = if (isGoogleConnected) {
            uiState.settings.googleAccountEmail
        } else {
            "Connect Google Tasks for two-way sync"
        },
        badgeText = if (isGoogleConnected) "Connected" else "Demo",
        onClick = { onOpenSubPage(SettingsSubPage.GOOGLE_SYNC) }
    )

    SettingsCategoryNavCard(
        icon = Icons.Outlined.Palette,
        title = "Appearance & Gemini AI",
        subtitle = if (uiState.settings.dynamicColorsEnabled) {
            "Dynamic wallpaper theme • On-device / AI partner"
        } else {
            "Expressive Sage theme • On-device / AI partner"
        },
        badgeText = null,
        onClick = { onOpenSubPage(SettingsSubPage.APPEARANCE_AND_AI) }
    )

    SettingsCategoryNavCard(
        icon = Icons.Outlined.BugReport,
        title = "Diagnostics & Demo Data",
        subtitle = "Crashlytics telemetry check, onboarding replay & sample reset",
        badgeText = null,
        onClick = { onOpenSubPage(SettingsSubPage.DIAGNOSTICS) }
    )
}

@Composable
private fun SettingsCategoryNavCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    badgeText: String?,
    onClick: () -> Unit
) {
    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
                Column {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (badgeText != null) {
                    MetaBadge(
                        text = badgeText,
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
                    contentDescription = "Open $title",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun PersonalitySubPage(
    selectedTone: PartnerTone,
    onSelectPartnerTone: (PartnerTone) -> Unit
) {
    Text(
        text = "Choose how your accountability partner speaks when tasks slip or pile up.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        PartnerTone.entries.forEach { tone ->
            val selected = selectedTone == tone
            Card(
                onClick = { onSelectPartnerTone(tone) },
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(
                    containerColor = if (selected) {
                        MaterialTheme.colorScheme.primaryContainer
                    } else {
                        MaterialTheme.colorScheme.surfaceContainerLow
                    }
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = tone.title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = tone.subtitle,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    if (selected) {
                        Icon(
                            imageVector = Icons.Outlined.CheckCircle,
                            contentDescription = "Selected",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GoogleSyncSubPage(
    uiState: PulseUiState,
    onLaunchGoogleSignIn: () -> Unit,
    onTriggerGoogleSync: () -> Unit,
    onSignOutGoogle: () -> Unit
) {
    val isGoogleConnected = uiState.settings.googleAccountEmail.isNotBlank()

    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = if (isGoogleConnected) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceContainerLow
            }
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Google Tasks Connection",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                MetaBadge(
                    text = if (isGoogleConnected) "Connected" else "Offline / Demo",
                    containerColor = if (isGoogleConnected) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.surfaceContainerHighest
                    },
                    contentColor = if (isGoogleConnected) {
                        MaterialTheme.colorScheme.onPrimary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = if (isGoogleConnected) {
                    "Signed in as ${uiState.settings.googleAccountEmail}. Tasks sync two-way with your Google Tasks lists."
                } else {
                    "Connect your Google Account via Google Play Services to sync your live Google Tasks."
                },
                style = MaterialTheme.typography.bodyMedium
            )

            Spacer(modifier = Modifier.height(16.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = onLaunchGoogleSignIn,
                    shape = CircleShape
                ) {
                    Text(if (isGoogleConnected) "Switch Google Account" else "Sign In with Google")
                }

                if (isGoogleConnected) {
                    OutlinedButton(
                        onClick = onTriggerGoogleSync,
                        enabled = !uiState.isSyncing,
                        shape = CircleShape
                    ) {
                        Icon(Icons.Outlined.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (uiState.isSyncing) "Syncing..." else "Sync Now")
                    }

                    TextButton(onClick = onSignOutGoogle) {
                        Text("Disconnect")
                    }
                }
            }
        }
    }
}

@Composable
private fun AppearanceAndAiSubPage(
    uiState: PulseUiState,
    onToggleDynamicColors: (Boolean) -> Unit,
    onSaveGeminiKey: (String) -> Unit
) {
    var geminiKeyInput by remember(uiState.settings.geminiApiKey) {
        mutableStateOf(uiState.settings.geminiApiKey)
    }

    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Material You Dynamic Colors",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Adapt palette to Android 12+ system wallpaper",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Switch(
                checked = uiState.settings.dynamicColorsEnabled,
                onCheckedChange = onToggleDynamicColors
            )
        }
    }

    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Outlined.AutoAwesome, contentDescription = null)
                Text(
                    text = "Gemini AI Key (Optional)",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Pulse includes an on-device heuristic partner by default. Add a Gemini API key for custom LLM breakdowns.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = geminiKeyInput,
                onValueChange = { geminiKeyInput = it },
                label = { Text("Gemini API Key") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = { onSaveGeminiKey(geminiKeyInput) },
                shape = CircleShape
            ) {
                Text("Save Key")
            }
        }
    }
}

@Composable
private fun DiagnosticsSubPage(
    onSendTestSignal: () -> Unit,
    onRestartOnboarding: () -> Unit,
    onResetDemoData: () -> Unit
) {
    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Observability & Demo Controls",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Dispatch a zero-PII diagnostic breadcrumb to Firebase Crashlytics, replay the onboarding flow, or restore sample tasks.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Button(
                onClick = onSendTestSignal,
                shape = CircleShape,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Send Test Telemetry to Crashlytics")
            }

            OutlinedButton(
                onClick = onRestartOnboarding,
                shape = CircleShape,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Replay Onboarding Flow")
            }

            OutlinedButton(
                onClick = onResetDemoData,
                shape = CircleShape,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Restore Sample Tasks")
            }
        }
    }
}
