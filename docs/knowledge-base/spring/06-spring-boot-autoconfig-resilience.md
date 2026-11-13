# Spring Enterprise: Spring Boot Auto-Configuration & Enterprise Resilience

Spring Boot simplifies enterprise application development through **Auto-Configuration**, **Externalized Configuration**, and **Production Starters**. Additionally, building resilient microservices requires integrating fault-tolerance mechanisms like **Resilience4j Circuit Breakers** and custom `@Async` thread pool executors.

---

## ⚙️ 1. Spring Boot Auto-Configuration Mechanics

Auto-configuration automatically configures Spring beans based on the libraries found on the classpath and property flags in `application.yml`.

### How Auto-Configuration Works Under the Hood

```
   Application Startup (@SpringBootApplication)
                        │
                        ▼
            @EnableAutoConfiguration
                        │
                        ▼
Reads AutoConfiguration.imports file from Classpath
META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
                        │
                        ▼
    Evaluates Conditional Annotations on Configuration Classes
   (e.g., @ConditionalOnClass, @ConditionalOnProperty, @ConditionalOnMissingBean)
                        │
                        ▼
   Registers Matching Beans in ApplicationContext
```

### Core Conditional Annotations

*   `@ConditionalOnClass(DataSource.class)`: Activates configuration only if `DataSource` class is on the classpath.
*   `@ConditionalOnMissingBean(PaymentService.class)`: Activates configuration only if the user hasn't defined their own `PaymentService` bean.
*   `@ConditionalOnProperty(name = "features.audit.enabled", havingValue = "true")`: Activates configuration based on property value.

---

## 📦 2. Writing a Custom Enterprise Spring Boot Starter

Enterprise organizations build custom starters to standardize logging, security, metrics, or payment integrations across microservices.

### Step 1: Create Auto-Configuration Class

```java
package com.company.starter.audit;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@EnableConfigurationProperties(AuditProperties.class)
@ConditionalOnProperty(prefix = "enterprise.audit", name = "enabled", havingValue = "true", matchIfMissing = true)
public class EnterpriseAuditAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public AuditService auditService(AuditProperties properties) {
        return new EnterpriseAuditService(properties.getDestinationTopic());
    }
}
```

### Step 2: Bind Configuration Properties

```java
package com.company.starter.audit;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "enterprise.audit")
public class AuditProperties {
    private boolean enabled = true;
    private String destinationTopic = "enterprise-audit-logs";

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getDestinationTopic() { return destinationTopic; }
    public void setDestinationTopic(String destinationTopic) { this.destinationTopic = destinationTopic; }
}
```

### Step 3: Register in Imports File
Create file `src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`:
```
com.company.starter.audit.EnterpriseAuditAutoConfiguration
```

---

## 🛡️ 3. Fault Tolerance & Resilience4j Integration

In enterprise microservices, downstream service calls (HTTP/gRPC/DB) will fail. Resilience4j provides lightweight fault tolerance.

```
Request ──► [ Circuit Breaker ] ──► [ Retry ] ──► [ Bulkhead ] ──► External HTTP API
```

### Circuit Breaker States:
*   **CLOSED**: Normal operation. Requests pass through.
*   **OPEN**: Failure threshold exceeded. Requests fail fast immediately, invoking fallback method without executing network calls.
*   **HALF-OPEN**: Trial state after wait duration. Allows limited test requests to check if downstream service recovered.

### Enterprise Resilience4j Code Blueprint

```java
package com.company.billing.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class ExternalPaymentGatewayClient {

    private final RestTemplate restTemplate;

    public ExternalPaymentGatewayClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @CircuitBreaker(name = "paymentGateway", fallbackMethod = "paymentFallback")
    @Retry(name = "paymentGateway")
    public String processCharge(String accountId, double amount) {
        return restTemplate.postForObject("https://gateway.external.com/charge", new ChargeRequest(accountId, amount), String.class);
    }

    // Fallback method MUST match signature + accept Throwable as final argument!
    public String paymentFallback(String accountId, double amount, Throwable t) {
        System.err.println("External Payment Gateway Failed: " + t.getMessage());
        return "FALLBACK_PAYMENT_QUEUED";
    }

    private record ChargeRequest(String accountId, double amount) {}
}
```

### Resilience4j `application.yml` Configuration

```yaml
resilience4j:
  circuitbreaker:
    instances:
      paymentGateway:
        slidingWindowType: COUNT_BASED
        slidingWindowSize: 10
        minimumNumberOfCalls: 5
        failureRateThreshold: 50.0 # Open circuit if 50% of last 10 calls fail
        waitDurationInOpenState: 10000ms # Stay OPEN for 10 seconds before HALF-OPEN
        permittedNumberOfCallsInHalfOpenState: 3
  retry:
    instances:
      paymentGateway:
        maxAttempts: 3
        waitDuration: 500ms
        enableExponentialBackoff: true
        exponentialBackoffMultiplier: 2
```

---

## ⚡ 4. Asynchronous Execution & Thread Pool Tuning (`@Async`)

Spring's `@Async` allows methods to execute in a background worker thread.

### ❌ Default `@Async` Danger
By default, if no custom `TaskExecutor` bean is configured, Spring uses `SimpleAsyncTaskExecutor`, which creates a **new Java thread for every single task**. Under heavy production load, this will crash the JVM with `java.lang.OutOfMemoryError: unable to create new native thread`.

### ✅ Enterprise ThreadPoolTaskExecutor Blueprint

```java
package com.company.billing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

@Configuration
@EnableAsync
public class AsyncThreadPoolConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);          // Base pool size
        executor.setMaxPoolSize(50);           // Maximum bursting pool size
        executor.setQueueCapacity(500);        // Capacity of bounded task queue
        executor.setThreadNamePrefix("async-worker-");
        
        // Rejection Policy: CallerRunsPolicy executes task on caller thread when queue is full
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
```
