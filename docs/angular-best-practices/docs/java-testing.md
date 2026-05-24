# Java Backend Testing

To deliver resilient, enterprise-grade Java backends, we enforce strict automated testing standards. We rely on **JUnit 5**, **Mockito** for core logic, and **Testcontainers** for real infrastructure integration tests.

---

## 🛠️ Mockito-Driven Pure Unit Tests

We write fast unit tests for our core `domain` services and `application` use cases without bootstrapping the heavy Spring Boot context. If a test imports `@SpringBootTest` to test a simple business rule, it is considered an anti-pattern.

```java
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class ProcessPaymentUseCaseTest {

    @Mock
    private PaymentGatewayPort paymentGatewayPort;

    @Mock
    private InvoiceRepositoryPort invoiceRepositoryPort;

    private ProcessPaymentService service;

    @BeforeEach
    void setUp() {
        service = new ProcessPaymentService(paymentGatewayPort, invoiceRepositoryPort);
    }

    @Test
    void payment_is_processed_successfully() {
        // Arrange
        Invoice invoice = new Invoice(UUID.randomUUID(), BigDecimal.valueOf(100.00));
        when(invoiceRepositoryPort.findById(invoice.getId())).thenReturn(Optional.of(invoice));
        when(paymentGatewayPort.charge(any(), any())).thenReturn(new PaymentResult(true));

        // Act
        boolean result = service.execute(invoice.getId());

        // Assert
        assertTrue(result);
        verify(invoiceRepositoryPort).save(invoice); // Verify side-effect
    }
}
```

---

## 🐳 Containerized Integration Tests (Testcontainers)

For outbound persistence and messaging adapters, mock testing is insufficient, and in-memory databases (like H2 or embedded Kafka) are dangerous. H2 does not support specific PostgreSQL extensions, JSONB queries, schema-specific constraints, or complex lock models, leading to "false green" tests that crash in production.

We mandate the use of **Testcontainers** to spin up real databases and brokers in localized Docker containers during the test build phase.

### Writing a PostgreSQL Containerized Test:

Add the test dependencies to your project:
```kotlin
// build.gradle.kts
testImplementation("org.testcontainers:junit-jupiter:1.19.3")
testImplementation("org.testcontainers:postgresql:1.19.3")
```

Create a base abstract container setup:

```java
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
public abstract class BaseIntegrationTest {

    // Automatically spins up a real, isolated PostgreSQL database inside Docker
    @Container
    private static final PostgreSQLContainer<?> postgres = 
        new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("test_db")
            .withUsername("test_user")
            .withPassword("test_pass");

    // Dynamically injects DB connection URLs into Spring context properties
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}
```

Implement the concrete Integration Test:

```java
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class JpaInvoiceRepositoryAdapterTest extends BaseIntegrationTest {

    @Autowired
    private JpaInvoiceRepositoryAdapter adapter;

    @Test
    void invoice_can_be_saved_and_retrieved_correctly() {
        // Arrange
        Invoice invoice = new Invoice(UUID.randomUUID(), BigDecimal.valueOf(500.00));

        // Act
        adapter.save(invoice);
        Optional<Invoice> retrieved = adapter.findById(invoice.getId());

        // Assert
        assertTrue(retrieved.isPresent());
        assertEquals(BigDecimal.valueOf(500.00), retrieved.get().getAmount());
    }
}
```

### Why Testcontainers is Mandatory:
*   **Parity**: Guarantees that SQL queries and migrations (such as Flyway or Liquibase) execute against the exact database engine version run in production.
*   **Isolation**: Each test runs on a clean, isolated database instance, completely preventing test database pollution.
