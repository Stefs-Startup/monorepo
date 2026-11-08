package com.pulse.accountability

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.rounded.ChatBubble
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Insights
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pulse.accountability.observability.PulseObservability
import com.pulse.accountability.ui.PulseUiState
import com.pulse.accountability.ui.PulseViewModel
import com.pulse.accountability.ui.components.MetaBadge
import com.pulse.accountability.ui.components.TaskPreparationSheet
import com.pulse.accountability.ui.components.Top3SwapBottomSheet
import com.pulse.accountability.ui.components.chat.PartnerChatMapper
import com.pulse.accountability.ui.components.chat.PartnerChatOverlay
import com.pulse.accountability.ui.screens.InteractiveHorizonHomeScreen
import com.pulse.accountability.ui.screens.MlpAccountabilityRadarScreen
import com.pulse.accountability.ui.screens.OnboardingScreen
import com.pulse.accountability.ui.screens.PartnerSettingsScreen
import com.pulse.accountability.ui.theme.PulseExpressiveTheme

enum class PulseTab(
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    HORIZON("Horizon", Icons.Rounded.Insights, Icons.Outlined.Insights),
    UNDONE_LOG("Undone Log", Icons.Rounded.History, Icons.Outlined.History),
    SETTINGS("Settings", Icons.Rounded.Tune, Icons.Outlined.Tune)
}

class MainActivity : ComponentActivity() {

    private val viewModel: PulseViewModel by viewModels {
        val app = application as PulseApplication
        PulseViewModel.provideFactory(app.repository, app.userPreferencesRepository)
    }

    private val googleSignInClient by lazy {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope("https://www.googleapis.com/auth/tasks"))
            .build()
        GoogleSignIn.getClient(this, gso)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BuildConfig.DEBUG && intent?.getBooleanExtra("e2e_mlp_radar", false) == true) {
            viewModel.completeOnboarding(silent = true)
        }
        if (BuildConfig.DEBUG && intent?.getBooleanExtra("e2e_open_chat_fab", false) == true) {
            viewModel.completeOnboarding(silent = true)
            viewModel.openDefaultConversationSheet()
        }
        if (BuildConfig.DEBUG && intent?.getBooleanExtra("e2e_open_chat_reply", false) == true) {
            viewModel.completeOnboarding(silent = true)
            viewModel.openDefaultConversationSheet(
                initialUserMessage = "It feels too big — let's shrink to 5m"
            )
        }
        if (BuildConfig.DEBUG && intent?.getBooleanExtra("e2e_auth_error_10", false) == true) {
            viewModel.restartOnboarding()
            viewModel.recordGoogleSignInLauncherFailure(
                com.google.android.gms.common.api.ApiException(
                    com.google.android.gms.common.api.Status(10, "10: DEVELOPER_ERROR")
                )
            )
        }
        val startTab = if (BuildConfig.DEBUG && intent?.getBooleanExtra("e2e_open_settings", false) == true) {
            viewModel.completeOnboarding(silent = true)
            PulseTab.SETTINGS
        } else {
            PulseTab.HORIZON
        }
        enableEdgeToEdge()
        setContent {
            val uiState by viewModel.uiState.collectAsStateWithLifecycle()
            val context = this
            val consentLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.StartActivityForResult()
            ) { result ->
                if (result.resultCode == RESULT_OK) {
                    val currentAccount = GoogleSignIn.getLastSignedInAccount(context)
                    if (currentAccount != null) {
                        viewModel.handleGoogleSignIn(currentAccount, context)
                    }
                }
            }

            val googleSignInLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.StartActivityForResult()
            ) { result ->
                val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
                task.addOnSuccessListener { account ->
                    viewModel.handleGoogleSignIn(account, context) { consentIntent ->
                        consentLauncher.launch(consentIntent)
                    }
                }.addOnFailureListener { ex ->
                    viewModel.recordGoogleSignInLauncherFailure(ex)
                }
            }

            PulseExpressiveTheme(
                dynamicColor = uiState.settings.dynamicColorsEnabled
            ) {
                if (!uiState.settings.hasCompletedOnboarding) {
                    OnboardingScreen(
                        uiState = uiState,
                        onToneSelected = viewModel::updatePartnerTone,
                        onLaunchGoogleSignIn = { googleSignInLauncher.launch(googleSignInClient.signInIntent) },
                        onToggleTop3 = viewModel::toggleTodayTop3,
                        onCompleteOnboarding = viewModel::completeOnboarding
                    )
                } else {
                    PulseAppShell(
                        uiState = uiState,
                        viewModel = viewModel,
                        initialTab = startTab,
                        onLaunchGoogleSignIn = { googleSignInLauncher.launch(googleSignInClient.signInIntent) }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PulseAppShell(
    uiState: PulseUiState,
    viewModel: PulseViewModel,
    initialTab: PulseTab = PulseTab.HORIZON,
    onLaunchGoogleSignIn: () -> Unit
) {
    var currentTab by remember { mutableStateOf(initialTab) }
    var selectedTaskForPrepId by remember { mutableStateOf<String?>(null) }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.statusBannerMessage) {
        val msg = uiState.statusBannerMessage
        if (!msg.isNullOrBlank()) {
            snackbarHostState.showSnackbar(msg)
            viewModel.clearBanner()
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = when (currentTab) {
                                PulseTab.HORIZON -> "Horizon"
                                PulseTab.UNDONE_LOG -> "Undone Log"
                                PulseTab.SETTINGS -> "Settings"
                            },
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        if (uiState.settings.googleAccessToken.isNotBlank()) {
                            MetaBadge(
                                text = "Synced",
                                containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }
                    }
                },
                actions = {
                    if (currentTab != PulseTab.SETTINGS) {
                        IconButton(
                            onClick = { viewModel.syncGoogleTasks() }
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Refresh,
                                contentDescription = "Sync Google Tasks"
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        },
        floatingActionButton = {
            if (currentTab != PulseTab.SETTINGS) {
                ExtendedFloatingActionButton(
                    onClick = { viewModel.openDefaultConversationSheet() },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                    icon = {
                        Icon(
                            imageVector = Icons.Rounded.ChatBubble,
                            contentDescription = "Reflect with Partner"
                        )
                    },
                    text = {
                        val label = if (uiState.stalledStatuses.isNotEmpty()) {
                            "Reflect (${uiState.stalledStatuses.size})"
                        } else {
                            "Reflect"
                        }
                        Text(
                            text = label,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                )
            }
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surfaceContainer
            ) {
                PulseTab.entries.forEach { tab ->
                    val selected = currentTab == tab
                    val badgeCount = when (tab) {
                        PulseTab.UNDONE_LOG -> uiState.stalledStatuses.size
                        else -> 0
                    }

                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            PulseObservability.recordBreadcrumb("nav_tab_selected", mapOf("tab" to tab.name))
                            currentTab = tab
                        },
                        icon = {
                            BadgedBox(
                                badge = {
                                    if (badgeCount > 0) {
                                        Badge { Text(badgeCount.toString()) }
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = if (selected) tab.selectedIcon else tab.unselectedIcon,
                                    contentDescription = tab.label
                                )
                            }
                        },
                        label = { Text(tab.label) }
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { innerPadding ->
        AnimatedContent(
            targetState = currentTab,
            modifier = Modifier.padding(innerPadding),
            label = "tabTransition"
        ) { tab ->
            when (tab) {
                PulseTab.HORIZON -> InteractiveHorizonHomeScreen(
                    uiState = uiState,
                    onSelectTaskById = { taskId ->
                        uiState.allTasks.find { it.id == taskId }?.let { viewModel.selectVisualTask(it) }
                    },
                    onTalkThroughTask = viewModel::openConversationForTask,
                    onToggleComplete = viewModel::toggleTaskCompleted,
                    onOpenFullLog = { currentTab = PulseTab.UNDONE_LOG }
                )

                PulseTab.UNDONE_LOG -> MlpAccountabilityRadarScreen(
                    uiState = uiState,
                    decodePrepSteps = viewModel::decodePrepSteps,
                    onTalkThroughTask = viewModel::openConversationForTask,
                    onToggleComplete = viewModel::toggleTaskCompleted,
                    onToggleTop3 = viewModel::toggleTodayTop3,
                    onOpenTaskPrep = { selectedTaskForPrepId = it.id }
                )

                PulseTab.SETTINGS -> PartnerSettingsScreen(
                    uiState = uiState,
                    onLaunchGoogleSignIn = onLaunchGoogleSignIn,
                    onSignOutGoogle = viewModel::disconnectGoogleAccount,
                    onTriggerGoogleSync = viewModel::syncGoogleTasks,
                    onSaveGeminiKey = viewModel::updateGeminiApiKey,
                    onSelectPartnerTone = viewModel::updatePartnerTone,
                    onToggleDynamicColors = viewModel::updateDynamicColors,
                    onResetDemoData = viewModel::resetDemoData,
                    onRestartOnboarding = viewModel::restartOnboarding,
                    onSendTestSignal = viewModel::sendTestObservabilitySignal
                )
            }
        }
    }

    // Swappable Full-Viewport Partner Chat Overlay (Routed via Reflect FAB & "Talk it through" actions)
    AnimatedVisibility(
        visible = uiState.isConversationSheetOpen,
        enter = slideInVertically(initialOffsetY = { it / 3 }) + fadeIn(),
        exit = slideOutVertically(targetOffsetY = { it / 3 }) + fadeOut()
    ) {
        BackHandler { viewModel.closeConversation() }
        val chatModel = remember(uiState) { PartnerChatMapper.fromUiState(uiState) }
        PartnerChatOverlay(
            model = chatModel,
            onEvent = { event ->
                viewModel.handlePartnerChatEvent(
                    event = event,
                    onNavigateToLog = { currentTab = PulseTab.UNDONE_LOG }
                )
            }
        )
    }

    // Task Preparation & Micro-step Breakdown Bottom Sheet
    val selectedTask = uiState.allTasks.find { it.id == selectedTaskForPrepId }
    if (selectedTask != null) {
        TaskPreparationSheet(
            task = selectedTask,
            prepSteps = viewModel.decodePrepSteps(selectedTask),
            coachingNote = uiState.activePrepCoachingMessage,
            isGenerating = uiState.isGeneratingPrepForTaskId == selectedTask.id,
            onDismiss = { selectedTaskForPrepId = null },
            onGeneratePartnerPrep = { viewModel.generatePartnerPrepChecklist(selectedTask) },
            onTogglePrepStep = { stepId -> viewModel.togglePrepStep(selectedTask, stepId) },
            onAddCustomPrepStep = { title -> viewModel.addCustomPrepStep(selectedTask, title) },
            onToggleTodayTop3 = { viewModel.toggleTodayTop3(selectedTask) },
            onTriageDecision = { decision -> viewModel.triageTask(selectedTask, decision) },
            onCompleteTask = { viewModel.toggleTaskCompleted(selectedTask) }
        )
    }

    // Finish Line Protected (Option A) Top-3 Swap Sheet
    val swapCandidate = uiState.pendingSwapCandidate
    if (swapCandidate != null) {
        Top3SwapBottomSheet(
            candidateTask = swapCandidate,
            currentTop3 = uiState.todayTop3Tasks,
            onDismiss = viewModel::dismissSwapModal,
            onSwap = viewModel::executeTop3Swap
        )
    }
}
