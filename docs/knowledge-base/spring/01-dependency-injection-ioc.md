# Spring Enterprise: IoC Container & Bean Lifecycle Internals

The **Inversion of Control (IoC) Container** is the core engine of the Spring Framework. In enterprise applications, understanding how Spring manages object creation, dependency injection, scoping, and the Bean lifecycle is critical to avoiding memory leaks, circular reference crashes, thread-safety bugs, and initialization failures.

---

## 🏛️ 1. Container Architecture: `BeanFactory` vs `ApplicationContext`

Spring provides two main container interfaces:

```
                      ┌──────────────────────┐
                      │     BeanFactory      │  (Basic IoC Container)
                      └──────────┬───────────┘
                                 │
                      ┌──────────┴───────────┐
                      │  ApplicationContext  │  (Enterprise IoC Container)
                      └──────────────────────┘
```

### `BeanFactory`
*   **Lazy Loading**: Instantiates beans on demand (when `getBean()` is explicitly invoked).
*   **Lightweight**: Minimal overhead, suitable for memory-constrained environments or mobile/embedded devices.
*   **Limitations**: Does NOT support automatic `BeanPostProcessor` registration, AOP integration, internationalization (`MessageSource`), or event publication out of the box.

### `ApplicationContext` (Mandatory for Enterprise Applications)
*   **Eager Loading**: Instantiates all `singleton` beans during container startup, catching configuration errors (e.g., missing dependencies or unparseable properties) at startup rather than runtime.
*   **Enterprise Extensions**: Includes full support for:
    *   AOP and declarative proxy generation.
    *   Event publication (`ApplicationEventPublisher`).
    *   Environment profiles and externalized configuration (`Environment`).
    *   `MessageSource` (i18n).
    *   Automatic detection and execution of `BeanFactoryPostProcessor` and `BeanPostProcessor` implementations.

---

## 🔄 2. The 11-Step Spring Bean Lifecycle

When `ApplicationContext` bootstraps, every singleton bean passes through a rigorous, well-defined lifecycle managed by Spring:

```
  1. Instantiation (Constructor / Factory Method)
                     │
  2. Populate Properties (Dependency Injection)
                     │
  3. BeanNameAware.setBeanName()
                     │
  4. BeanFactoryAware.setBeanFactory()
                     │
  5. ApplicationContextAware.setApplicationContext()
                     │
  6. BeanPostProcessor.postProcessBeforeInitialization()
                     │
  7. @PostConstruct annotated methods
                     │
  8. InitializingBean.afterPropertiesSet()
                     │
  9. Custom init-method (defined in @Bean(initMethod = "..."))
                     │
 10. BeanPostProcessor.postProcessAfterInitialization()  <── (AOP Proxy Generation occurs here!)
                     │
 11. BEAN IS READY FOR USE
                     │
 12. Container Shutdown ──> @PreDestroy / DisposableBean.destroy() / Custom destroy-method
```

### Detailed Execution Phase Breakdown

1.  **Instantiation**: Spring invokes the constructor or factory method to allocate memory for the target instance.
2.  **Property Population**: Dependency Injection takes place. Spring resolves dependencies via constructor arguments, field reflection, or setter methods.
3.  **Aware Interfaces**: If the bean implements Spring `Aware` marker interfaces (`BeanNameAware`, `BeanFactoryAware`, `ApplicationContextAware`, `EnvironmentAware`), Spring injects container references into the bean.
4.  **`BeanPostProcessor.postProcessBeforeInitialization()`**: Custom logic executed on the raw instance BEFORE any initialization methods run (e.g., parsing annotations like `@Scheduled` or validating bean fields).
5.  **Initialization Methods**:
    *   First: `@PostConstruct` annotated methods (JSR-250 standard).
    *   Second: `InitializingBean.afterPropertiesSet()`.
    *   Third: Custom `@Bean(initMethod = "init")` method.
6.  **`BeanPostProcessor.postProcessAfterInitialization()`**: Executed AFTER initialization. **Crucial**: Spring AOP generates dynamic proxies (JDK Dynamic Proxy or CGLIB) during this step. If a bean is annotated with `@Transactional`, `@Async`, or `@Observed`, the raw instance is wrapped inside a proxy, and the proxy is registered in the IoC container singleton registry.
7.  **Destruction**: During graceful shutdown (`ApplicationContext.close()`), Spring calls `@PreDestroy`, `DisposableBean.destroy()`, and custom `destroyMethod`.

---

## 🧪 3. Enterprise Bean Scopes & Scoped Proxies

| Scope | Identifier | Description | Enterprise Use Case |
| :--- | :--- | :--- | :--- |
| **Singleton** *(Default)* | `ConfigurableBeanFactory.SCOPE_SINGLETON` | Exactly **one** instance per `ApplicationContext`. Shared across all requests and threads. | Stateless services, repositories, configurations, utility clients. |
| **Prototype** | `ConfigurableBeanFactory.SCOPE_PROTOTYPE` | A **new instance** is created every time the bean is requested. Spring does NOT manage prototype destruction. | Stateful task workers, mutable data accumulators. |
| **Request** | `WebApplicationContext.SCOPE_REQUEST` | One instance per HTTP request lifecycle. Destroyed when HTTP request finishes. | User request context, HTTP payload aggregators, audit loggers. |
| **Session** | `WebApplicationContext.SCOPE_SESSION` | One instance per HTTP `HttpSession`. | User shopping carts, user session preference state. |
| **Application** | `WebApplicationContext.SCOPE_APPLICATION` | One instance per `ServletContext`. | App-wide web state, feature flag caches across web app. |

### ⚠️ The Scope Impedance Mismatch Trap (Singleton Injecting Request Scope)

A major enterprise trap occurs when a **Singleton** bean (e.g., `OrderService`) injects a **Request-scoped** bean (e.g., `UserContext`). Because the Singleton is instantiated *once* at container startup when no HTTP request exists, injecting the Request bean directly will either fail at startup or bind a single stale request context forever.

#### Production Solution: Scoped Proxy (`ScopedProxyMode.TARGET_CLASS`)

By declaring `proxyMode = ScopedProxyMode.TARGET_CLASS`, Spring injects a **CGLIB Dynamic Proxy** into the Singleton. Whenever a method on `UserContext` is called, the proxy resolves the active HTTP request context dynamically from `RequestContextHolder` (`ThreadLocal`).

```java
package com.company.billing.config;

import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;
import org.springframework.web.context.WebApplicationContext;

@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class UserContext {
    private String userId;
    private String tenantId;
    private String authToken;

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}
```

```java
package com.company.billing.service;

import com.company.billing.config.UserContext;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    private final UserContext userContext; // Safe to inject into Singleton via Scoped Proxy!

    public OrderService(UserContext userContext) {
        this.userContext = userContext;
    }

    public void processOrder() {
        // Automatically delegates to current ThreadLocal HTTP request instance
        String tenantId = userContext.getTenantId();
        System.out.println("Processing order for tenant: " + tenantId);
    }
}
```

---

## 💉 4. Injection Strategies: Constructor vs Setter / Field Injection

### ❌ Field Injection (`@Autowired` on Private Fields) — BANNED IN ENTERPRISE

```java
// Anti-Pattern: DO NOT DO THIS
@Service
public class PaymentService {
    @Autowired
    private MerchantRepository merchantRepository; // Hidden dependency, untestable without Reflection
}
```

**Why Field Injection is Banned:**
1.  **Immutability Violation**: Fields cannot be declared `final`.
2.  **Testing Friction**: Requires reflection-based test utilities (`ReflectionTestUtils`) or Spring runner setup for plain unit tests.
3.  **Null Safety Risk**: Instantiating `new PaymentService()` in pure Java yields `null` for `merchantRepository` without compiler warnings.
4.  **Hides Circular Dependencies**: Spring cannot detect circular dependencies at class loading time when field injection is used.

### ✅ Constructor Injection — MANDATORY ENTERPRISE PATTERN

```java
package com.company.billing.service;

import com.company.billing.ports.MerchantRepositoryPort;
import com.company.billing.ports.PaymentGatewayPort;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
public class PaymentService {

    private final MerchantRepositoryPort merchantRepository;
    private final PaymentGatewayPort paymentGateway;

    // Explicit constructor injection (Lombok @RequiredArgsConstructor can also be used)
    public PaymentService(MerchantRepositoryPort merchantRepository, PaymentGatewayPort paymentGateway) {
        this.merchantRepository = Objects.requireNonNull(merchantRepository, "merchantRepository must not be null");
        this.paymentGateway = Objects.requireNonNull(paymentGateway, "paymentGateway must not be null");
    }

    public void executePayment(String merchantId, double amount) {
        var merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new IllegalArgumentException("Merchant not found: " + merchantId));
        paymentGateway.charge(merchant.getAccount(), amount);
    }
}
```

**Benefits:**
*   **Immutability**: All dependencies are declared `final`.
*   **Compiler-Enforced Contracts**: Instantiating `PaymentService` requires providing all mandatory dependencies.
*   **Zero Spring Overhead in Unit Tests**: Mockito tests instantiate `PaymentService` directly via standard `new PaymentService(mockRepo, mockGateway)` without starting a Spring Context.

---

## 🔄 5. Circular Dependency Mechanics & Solutions

A Circular Dependency occurs when `ServiceA` requires `ServiceB`, and `ServiceB` requires `ServiceA`.

### How Spring Handles Circular Dependencies

Spring uses a **Three-Level Cache Architecture** inside `DefaultSingletonBeanRegistry`:
1.  `singletonObjects` (Cache level 1): Fully initialized and proxied singletons.
2.  `earlySingletonObjects` (Cache level 2): Early raw references (before initialization) to break cycles.
3.  `singletonFactories` (Cache level 3): ObjectFactory wrappers for creating early proxy references.

*Note*: Starting in **Spring Boot 2.6+**, circular references are **disabled by default** (`spring.main.allow-circular-references=false`) because circular dependencies usually signal poor architectural domain boundaries.

### Architectural Fixes for Circular Dependencies

#### Solution 1: Refactor to Event-Driven / Domain Boundary (Recommended)
Extract shared coordination logic into a domain service or use Spring `ApplicationEventPublisher`.

#### Solution 2: Break Cycle with `@Lazy` Annotation
If refactoring is blocked, use `@Lazy` on one of the constructor parameters. Spring will inject a lazy CGLIB proxy that postpones resolving the underlying bean until a method is actually invoked.

```java
package com.company.billing.service;

import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

    private final UserService userService;

    public NotificationService(@Lazy UserService userService) { // Breaks constructor circularity
        this.userService = userService;
    }

    public void sendWelcomeEmail(String userId) {
        var user = userService.getUserProfile(userId);
        System.out.println("Sending email to " + user.getEmail());
    }
}
```
