# Spring Enterprise: `@Transactional` & Transaction Management Internals

Declarative transaction management (`@Transactional`) is one of Spring's most powerful features. However, misuse leads to data corruption, silent transaction rollbacks, deadlocks, connection pool exhaustion, and hard-to-debug runtime failures.

---

## ⚙️ 1. How `@Transactional` Works Under the Hood (Spring AOP Proxy Engine)

Spring's `@Transactional` annotation does **NOT** modify your Java class code. Instead, Spring creates an **AOP Proxy** (JDK Dynamic Proxy or CGLIB) that intercepts calls to the target bean:

```
Caller (e.g. REST Controller)
             │
             ▼
┌────────────────────────────────────────────────────────┐
│               Spring AOP Dynamic Proxy                 │
│                                                        │
│  1. TransactionInterceptor.invoke()                    │
│     ├── Obtains Connection from TransactionManager      │
│     ├── Begins DB Transaction (connection.setAutoCommit(false))
│     │                                                  │
│     ▼                                                  │
│  2. Invoke Actual Target Bean Method                   │
│     (e.g., InvoiceService.createInvoice())             │
│                                                        │
│     ▼                                                  │
│  3. Handle Outcome:                                    │
│     ├── If Success ──> connection.commit()             │
│     └── If RuntimeException ──> connection.rollback()  │
└────────────────────────────────────────────────────────┘
```

### Key Components

*   **`TransactionInterceptor`**: An AOP MethodInterceptor that wraps method calls in a transaction lifecycle.
*   **`PlatformTransactionManager`**: The core strategy interface (e.g., `JpaTransactionManager`, `DataSourceTransactionManager`).
*   **`TransactionSynchronizationManager`**: Maintains active database connections, transaction status (`isActualTransactionActive()`), and isolation levels bound to the current thread (`ThreadLocal`).

---

## 🔀 2. Transaction Propagation Types Demystified

Transaction propagation dictates what happens when a transactional method calls another transactional method.

| Propagation Type | Behavior if Parent Transaction Exists | Behavior if NO Parent Transaction Exists | Enterprise Use Case |
| :--- | :--- | :--- | :--- |
| **`REQUIRED`** *(Default)* | Joins existing parent transaction. | Creates a **new** transaction. | Standard business workflows (95% of use cases). |
| **`REQUIRES_NEW`** | **Suspends** parent transaction, creates an independent **new** transaction. | Creates a **new** transaction. | Independent audit logging, billing execution, notification tracking that must succeed/fail regardless of parent transaction outcome. |
| **`NESTED`** | Creates a **savepoint** within parent transaction. | Creates a **new** transaction. | Complex multi-step operations where sub-steps can roll back to a savepoint without aborting the parent. |
| **`SUPPORTS`** | Joins parent transaction. | Executes **non-transactionally**. | Read-only lookup methods that benefit from existing transactions if present. |
| **`MANDATORY`** | Joins parent transaction. | Throws `IllegalTransactionStateException`. | Helper repository/service methods that MUST execute inside an established business transaction boundary. |
| **`NOT_SUPPORTED`**| **Suspends** parent transaction, executes non-transactionally. | Executes non-transactionally. | Methods that perform long-running third-party HTTP calls or file generation. |
| **`NEVER`** | Throws `IllegalTransactionStateException`. | Executes non-transactionally. | Legacy non-thread-safe procedures that fail if wrapped in a transaction. |

### Enterprise Code Blueprint: `REQUIRES_NEW` Audit Logger Pattern

If an order creation fails, we still want to persist an audit log entry in the database.

```java
package com.company.billing.service;

import com.company.billing.model.AuditLog;
import com.company.billing.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLoggerService {

    private final AuditLogRepository auditLogRepository;

    public AuditLoggerService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    // REQUIRES_NEW ensures this commit completes even if caller transaction rolls back!
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAction(String action, String details) {
        AuditLog log = new AuditLog(action, details);
        auditLogRepository.save(log);
    }
}
```

---

## 🛡️ 3. Database Isolation Levels & Concurrency Phenomena

Spring supports setting isolation levels via `@Transactional(isolation = Isolation.READ_COMMITTED)`:

| Isolation Level | Dirty Read Prevention | Non-Repeatable Read Prevention | Phantom Read Prevention | Performance Overhead |
| :--- | :---: | :---: | :---: | :---: |
| **`DEFAULT`** | *Database Specific* | *Database Specific* | *Database Specific* | Low |
| **`READ_UNCOMMITTED`** | ❌ No | ❌ No | ❌ No | Lowest |
| **`READ_COMMITTED`** *(PostgreSQL Default)* | ✅ Yes | ❌ No | ❌ No | Low |
| **`REPEATABLE_READ`** *(MySQL InnoDB Default)* | ✅ Yes | ✅ Yes | ❌ No | Medium |
| **`SERIALIZABLE`** | ✅ Yes | ✅ Yes | ✅ Yes | Highest (High Lock Contention) |

### Concurrency Phenomena Defined:
*   **Dirty Read**: Reading uncommitted data written by a concurrent transaction that might subsequently roll back.
*   **Non-Repeatable Read**: Re-reading the same row within a transaction yields different data because another transaction modified and committed that row.
*   **Phantom Read**: Re-executing a range query yields new "phantom" rows inserted and committed by another transaction.

---

## 💥 4. Rollback Mechanics & The Exception Trap

### Default Spring Rollback Rule
By default, Spring transactions roll back **ONLY** on unchecked exceptions (`RuntimeException` and `Error`). They do **NOT** roll back on checked exceptions (`Exception` or custom subclass of `Exception`).

```java
// DANGEROUS: Checked Exception DOES NOT trigger transaction rollback!
@Transactional
public void processOrder(OrderRequest request) throws InsufficientInventoryException {
    orderRepository.reduceStock(request.getItemId(), request.getQty());
    if (stock < 0) {
        // InsufficientInventoryException extends Exception (Checked)
        throw new InsufficientInventoryException("Out of stock!"); // DB CHANGES ARE STILL COMMITTED!
    }
}
```

### ✅ Production Best Practice: Mandatory `rollbackFor`
Always specify `rollbackFor = Exception.class` to ensure any exception triggers a rollback:

```java
@Transactional(rollbackFor = Exception.class)
public void processOrder(OrderRequest request) throws InsufficientInventoryException {
    orderRepository.reduceStock(request.getItemId(), request.getQty());
    if (stock < 0) {
        throw new InsufficientInventoryException("Out of stock!"); // Properly rolled back!
    }
}
```

---

## ⚠️ 5. Critical `@Transactional` Proxy Traps & Anti-Patterns

### Trap 1: Self-Invocation (Internal Call Bypass)

```java
@Service
public class OrderService {

    public void processBatch() {
        // Self-invocation! Calls method on 'this' directly, bypassing the Spring AOP Proxy!
        // @Transactional on updateOrder() IS ENTIRELY IGNORED!
        this.updateOrder();
    }

    @Transactional
    public void updateOrder() {
        // Transactional logic...
    }
}
```

#### Fix 1: Inject Self-Reference or Extract to Separate Service (Recommended)
Extract `updateOrder()` into a dedicated domain/service class or use `ApplicationContext` / self-injection:

```java
@Service
public class OrderService {

    private final OrderService self; // Inject self-proxy

    public OrderService(@Lazy OrderService self) {
        this.self = self;
    }

    public void processBatch() {
        self.updateOrder(); // Now goes through Spring AOP proxy! @Transactional works!
    }

    @Transactional
    public void updateOrder() {
        // Transactional logic...
    }
}
```

---

### Trap 2: Non-Public Method Annotation

```java
@Service
public class InvoiceService {

    // INVALID: Spring AOP proxies ignore @Transactional on private, protected, or package-private methods!
    @Transactional
    private void calculateTaxes() {
        // Transaction will NOT be opened!
    }
}
```

**Rule**: `@Transactional` methods must be `public`.

---

### Trap 3: Holding Transactions Across Remote Network Boundaries (Connection Exhaustion)

```java
// ANTI-PATTERN: Database connection held during 5-second external HTTP call!
@Transactional
public void ProcessPaymentAndNotify(PaymentRequest request) {
    paymentRepository.save(payment);

    // DANGEROUS: Thread holds DB connection locked while waiting for remote HTTP API!
    // Connection Pool (HikariCP) will rapidly exhaust under heavy load.
    restTemplate.postForEntity("https://third-party-gateway/charge", request, String.class);

    payment.setStatus(PaymentStatus.COMPLETED);
}
```

#### Production Solution: Transaction Separation
Separate database transaction boundaries from external I/O operations using `TransactionTemplate` or isolated service boundaries.

```java
@Service
public class PaymentFacade {

    private final PaymentService paymentService;
    private final ExternalGatewayClient gatewayClient;

    public PaymentFacade(PaymentService paymentService, ExternalGatewayClient gatewayClient) {
        this.paymentService = paymentService;
        this.gatewayClient = gatewayClient;
    }

    public void processPaymentAndNotify(PaymentRequest request) {
        // Step 1: Short DB transaction to insert record
        Long paymentId = paymentService.createPendingPayment(request);

        // Step 2: External network call WITHOUT holding DB connection
        var response = gatewayClient.charge(request);

        // Step 3: Short DB transaction to update status
        paymentService.updatePaymentStatus(paymentId, response.getStatus());
    }
}
```
