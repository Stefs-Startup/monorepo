# 5. Spring Boot 4 & Modern Java 21 Backend Best Practices

> **Stack Scope**: Spring Boot `4.0.9`, Java `21` (OpenJDK Toolchain), Jakarta Bean Validation, JUnit 5, and Spring `MockMvc`.
> **Real App Reference**: `apps/pulse/backend/` (Experimental API Companion in `Stefs-Startup/monorepo`)

---

## 1. Modern Java 21 Language Primitives Over Boilerplate

We write zero-Lombok, immutable Java 21 code using **Records**, **Sealed Interfaces**, and **Pattern-Matching Switch Expressions**.

### 1.1 Immutable `record` Types for Domain Models & DTOs
Real example from [`TaskItem.java`](../../../backend/src/main/java/com/pulse/backend/domain/TaskItem.java) and [`PulseDtos.java`](../../../backend/src/main/java/com/pulse/backend/api/PulseDtos.java):
```java
public record TriageRequest(
    @NotBlank String actionType,
    String parameter
) {}
```
- Immutable by default, thread-safe under Java 21 Virtual Threads, and serializes cleanly with Jackson without getter/setter ceremony.

### 1.2 `sealed interface` + Exhaustive Pattern Matching `switch`
Real example from [`ScarcityEngine.java`](../../../backend/src/main/java/com/pulse/backend/domain/ScarcityEngine.java) and [`TriageRules.java`](../../../backend/src/main/java/com/pulse/backend/domain/TriageRules.java):
```java
public sealed interface PinDecision permits PinDecision.AllowPin, PinDecision.Unpin, PinDecision.SwapRequired {
    record AllowPin() implements PinDecision {}
    record Unpin() implements PinDecision {}
    record SwapRequired(List<TaskItem> currentCommitments) implements PinDecision {}
}
```
When handling `TriageAction` in `TriageRules.applyTriageAction()`, the Java 21 compiler enforces exhaustiveness across all permitted record subtypes without a fragile `default:` branch:
```java
return switch (action) {
    case TriageAction.CommitToday ignored -> task.withCommitment(TaskCommitmentState.TODAY_TOP_3, nowMillis);
    case TriageAction.ShrinkTo5m ignored -> task.withShrunkTitleAndTop3(nowMillis);
    case TriageAction.Reschedule r -> task.withRescheduledDue(r.targetDate(), zone, nowMillis);
    case TriageAction.Delegate d -> task.withBlockerNote("Waiting on: " + d.waitingOn().trim(), nowMillis);
    case TriageAction.ParkSomeday ignored -> task.withParkedSomeday(nowMillis);
    case TriageAction.DropConsciously ignored -> task.withCompleted(nowMillis);
};
```

---

## 2. Spring Boot 4 Gradle & Dependency Best Practices

### Key Lesson Learned in `Pulse` (`Spring Boot 4.0.9`)
In **Spring Boot 4.0+**, web test annotations (`@WebMvcTest`, `@AutoConfigureMockMvc`) moved to modular starter coordinates, and standalone `MockMvcBuilders.standaloneSetup(controller)` provides ultra-fast (< 1s) HTTP contract tests without booting the entire servlet container:

```kotlin
// backend/build.gradle.kts
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-webmvc-test")
}
```

---

## 3. Fast HTTP Contract Verification with `MockMvc`

Every REST endpoint in [`PulseController.java`](../../../backend/src/main/java/com/pulse/backend/api/PulseController.java) is verified in [`PulseControllerContractTest.java`](../../../backend/src/test/java/com/pulse/backend/api/PulseControllerContractTest.java) for status codes (`200 OK`, `404 Not Found`), JSON structure, descending Horizon window order, and Top-3 scarcity swap enforcement:

```java
@BeforeEach
void setUp() {
    PulseAccountabilityService service = new PulseAccountabilityService();
    mockMvc = MockMvcBuilders.standaloneSetup(new PulseController(service)).build();
}

@Test
void getDashboardStateReturnsDescendingWindowsAnd18PassingContrastPairs() throws Exception {
    mockMvc.perform(get("/api/v1/pulse/state"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.horizon.windows", hasSize(3)))
        .andExpect(jsonPath("$.wcagContrastAudit", hasSize(18)));
}
```
