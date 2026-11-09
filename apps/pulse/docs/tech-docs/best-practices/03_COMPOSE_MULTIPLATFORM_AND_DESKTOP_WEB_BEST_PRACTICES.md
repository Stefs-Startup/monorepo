# 3. Compose Multiplatform & Modern Desktop Web UX Best Practices

> **Stack Scope**: JetBrains Compose Multiplatform (`1.7+`), `wasmJs` (Canvas/Skia Web), Jetpack Compose Material 3, and Adaptive Desktop Web Ergonomics (`ADR-009`).
> **Real App Reference**: [`AccountabilityHorizonCanvas.kt`](../../../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt), [`StalledTaskLogCard.kt`](../../../app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt), [`PartnerSettingsNavigator.kt`](../../../app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt), [`PulseExpressiveTheme.kt`](../../../app/src/main/java/com/pulse/accountability/ui/theme/PulseExpressiveTheme.kt)

---

## 1. Core Principle: Share Components in `commonMain`, Adapt to Desktop Web Ergonomics (`ADR-009`)

A common pitfall when bringing a mobile Compose app to the Web (`wasmJs`) is rendering a giant stretched phone layout with a bottom navigation bar, oversized rounded cards, and swipe-only gestures.

**Our Standard (`ADR-009`)**:
1. **100% Shared Components**: Write [`AccountabilityHorizonCanvas`](../../../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt), [`StalledTaskLogCard`](../../../app/src/main/java/com/pulse/accountability/ui/components/StalledTaskLogCard.kt), and [`PartnerSettingsNavigator`](../../../app/src/main/java/com/pulse/accountability/ui/screens/settings/PartnerSettingsNavigator.kt) **once** in `commonMain`.
2. **Modern Desktop Web Principles on Wide Viewports (`>= 840.dp`)**:
   - **Multi-Pane Split Workspace**: Never stack the Selected Task Inspector below the fold on desktop. Render a **2-column split workspace** (`Row` with `max-width: 1440.dp`):
     - **Left/Center Main Pane (`weight(1.35f)`)**: Today's Top 3 Scarcity Strip + 3-Window Descending Horizon.
     - **Right Docked Inspector Pane (`weight(1f)` / `400.dp`)**: Persistent Selected Task Inspector with 1-tap visual triage actions (`Pin to Top 3`, `Shrink to 5m`, `Tomorrow`, `Park`, `Done ✓`).
   - **Desktop Navigation Chrome**: Replace the mobile bottom `NavigationBar` with a compact left sidebar / workspace rail or slim top command bar on desktop (`>= 840.dp`).
   - **Crisp Borders & Spatial Density**: On desktop web, pair subtle surface contrast with `1.dp` hairline borders (`MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f)`) and tighter corner radii (`12.dp–16.dp`) instead of heavy mobile drop shadows.
   - **Pointer Hover, Clickable Window Tabs & Keyboard Shortcuts**:
     - Every bar in the Horizon window must be directly clickable and highlight on pointer hover (`Modifier.hoverable()` + `PointerIcon.Hand`).
     - Support keyboard navigation (`1`/`2`/`3` to switch Horizon windows, `↑`/`↓` to move between ranked bars `#1..#N`, `P` to Pin Top 3, `S` to Shrink to 5m, `D` for Done).

---

## 2. Responsive Layout Pattern (`BoxWithConstraints` in `commonMain`)

Use `BoxWithConstraints` at the screen shell level so the same shared child composables automatically arrange into a **Mobile Single-Column Stack** (`maxWidth < 840.dp`) or a **Modern Desktop Multi-Pane Workspace** (`maxWidth >= 840.dp`):

```kotlin
@Composable
fun ResponsiveHorizonWorkspace(
    snapshot: TaskHorizonAnalyticsSnapshot,
    selectedTask: TaskItemEntity?,
    onSelectTaskById: (String) -> Unit,
    onTriageAction: (TaskItemEntity, TriageAction) -> Unit,
    onMarkTaskDone: (TaskItemEntity) -> Unit,
    modifier: Modifier = Modifier
) {
    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val isDesktopWebLayout = maxWidth >= 840.dp

        if (isDesktopWebLayout) {
            // Modern Desktop Web 2-Pane Split Workspace (Zero Vertical Page Jumping)
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 28.dp, vertical = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                Column(
                    modifier = Modifier.weight(1.35f),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Top3ScarcityStrip(/* ... */)
                    HorizonWindowPagerCard(
                        snapshot = snapshot,
                        selectedTaskId = selectedTask?.id,
                        onSelectTaskById = onSelectTaskById
                    )
                }
                Box(modifier = Modifier.weight(1f)) {
                    SelectedNodeInspectorCard(
                        task = selectedTask,
                        onTriageAction = onTriageAction,
                        onMarkDone = onMarkTaskDone
                    )
                }
            }
        } else {
            // Mobile (< 840.dp) Single-Column Stacked Layout
            AccountabilityHorizonSection(
                snapshot = snapshot,
                selectedTask = selectedTask,
                onSelectTaskById = onSelectTaskById,
                onReflectOnTask = { /* ... */ },
                onMarkTaskDone = onMarkTaskDone
            )
        }
    }
}
```

---

## 3. Spring-Physics Micro-Interactions & WCAG 2.2 AA Contrast

1. **Spring Physics Over Linear Tweens**:
   - As implemented in [`AccountabilityHorizonCanvas.kt`](../../../app/src/main/java/com/pulse/accountability/ui/components/AccountabilityHorizonCanvas.kt), use `animateFloatAsState` with `spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow)` for proportional bar fills so window changes feel alive without lag.
2. **Deterministic WCAG 2.2 AA Contrast Gate (`WcagContrastEngine.kt`)**:
   - Every token pair in [`PulseExpressiveTheme.kt`](../../../app/src/main/java/com/pulse/accountability/ui/theme/PulseExpressiveTheme.kt) (`ExpressiveLightColors` and `ExpressiveDarkColors`) is verified by [`WcagContrastEngineTest.kt`](../../../app/src/test/java/com/pulse/accountability/ui/theme/WcagContrastEngineTest.kt) to guarantee `>= 4.5:1` contrast ratio before any mobile or web bundle is shipped.
