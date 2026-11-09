# 1. Kotlin (`2.1+`) & Pure Functional Domain Best Practices

> **Stack Scope**: Kotlin `2.1.0`, `kotlinx.coroutines` (`StateFlow`), `kotlinx.serialization`, and JUnit4 / `kotlin.test`.
> **Real App Reference**: `apps/pulse/app/src/main/java/com/pulse/accountability/domain/`

---

## 1. Core Rule: Pure Functions First (`ADR-007`)

Every business rule—task drift classification, descending Horizon bar ranking, Top-3 scarcity enforcement, triage state transitions, and WCAG 2.2 contrast math—must live in a **stateless Kotlin `object` or top-level function** with **zero Android `Context`, database, or network dependencies**.

### Why This Matters (Our Learning in `Pulse`)
- Pure functions execute in **milliseconds** on the local JVM or WebAssembly (`wasmJs`) without needing an Android emulator or browser DOM.
- Every edge case (e.g., a task deferred `5×` vs. untouched for `9d`) can be deterministically asserted with plain data classes.

---

## 2. Model Domain Decisions with `sealed interface` (Algebraic Data Types)

Never return ambiguous `Boolean` flags or nullable error strings from domain engines. Use a **`sealed interface`** so the compiler forces every caller (UI or ViewModel) to handle all outcomes exhaustively.

### Real Example from `Pulse` ([`ScarcityEngine.kt`](../../../app/src/main/java/com/pulse/accountability/domain/ScarcityEngine.kt))
```kotlin
sealed interface PinDecision {
    data object AllowPin : PinDecision
    data object Unpin : PinDecision
    data class SwapRequired(val currentCommitments: List<TaskItemEntity>) : PinDecision
}

object ScarcityEngine {
    const val MAX_TOP_3_LIMIT = 3

    fun evaluatePinAction(
        currentTop3: List<TaskItemEntity>,
        candidate: TaskItemEntity
    ): PinDecision {
        val isAlreadyPinned = candidate.commitment == TaskCommitmentState.TODAY_TOP_3 ||
            currentTop3.any { it.id == candidate.id }

        if (isAlreadyPinned) return PinDecision.Unpin
        if (currentTop3.size < MAX_TOP_3_LIMIT) return PinDecision.AllowPin
        return PinDecision.SwapRequired(currentCommitments = currentTop3.take(MAX_TOP_3_LIMIT))
    }
}
```

### Real Example from `Pulse` ([`TriageRules.kt`](../../../app/src/main/java/com/pulse/accountability/domain/TriageRules.kt))
```kotlin
sealed interface TriageAction {
    data object CommitToday : TriageAction
    data object ShrinkTo5m : TriageAction
    data class Reschedule(val targetDate: LocalDate) : TriageAction
    data class Delegate(val waitingOn: String) : TriageAction
    data object ParkSomeday : TriageAction
    data object DropConsciously : TriageAction
}
```

---

## 3. Immutable State Transitions via `.copy()`

Domain functions must never mutate fields in place. Accept an immutable `data class` and return a new instance via `.copy()`, injecting `nowMillis` and `today` as default parameters so tests are 100% deterministic.

### Real Example from `Pulse` (`TriageRules.applyTriageAction`)
```kotlin
fun applyTriageAction(
    task: TaskItemEntity,
    action: TriageAction,
    today: LocalDate,
    nowMillis: Long
): TaskItemEntity = when (action) {
    is TriageAction.ShrinkTo5m -> {
        val cleanTitle = if (task.title.startsWith("5m starter: ")) task.title else "5m starter: ${task.title}"
        task.copy(
            title = cleanTitle,
            energyLevel = TaskEnergyLevel.QUICK_WIN.name,
            commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
            updatedEpochMillis = nowMillis,
            dirtySync = true
        )
    }
    // ... other exhaustive branches
}
```

---

## 4. Strict Descending Analytical Ordering (`compareByDescending`)

When building visual analytics (such as the 3 Horizon windows in [`TaskVisualAnalyticsEngine.kt`](../../../app/src/main/java/com/pulse/accountability/domain/TaskVisualAnalyticsEngine.kt)), always use chained `compareByDescending` comparators with a deterministic tie-breaker (`thenBy { it.task.title }`) so UI bars never jitter across recompositions:

```kotlin
val habitualStatuses = openStatuses
    .filter { it.category == AccountabilityCategory.HABITUALLY_DEFERRED }
    .sortedWith(
        compareByDescending<TaskAccountabilityStatus> { it.task.deferCount }
            .thenByDescending { maxOf(it.daysOverdue, it.daysUntouched, it.daysOld) }
            .thenBy { it.task.title }
    )
```

---

## 5. Checklist for New Kotlin Domain Code
- [ ] Zero `android.*` imports in domain or analytics files.
- [ ] All time/clock inputs (`nowMillis`, `today`) are passed as parameters with sensible defaults.
- [ ] Multi-branch outcomes use `sealed interface` + `data object` / `data class`.
- [ ] 100% unit test coverage in `src/test` / `commonTest` before wiring to any UI.
