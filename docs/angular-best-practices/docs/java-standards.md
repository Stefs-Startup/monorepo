# Modern Java & Spring Boot Standards

Enterprise Java has transformed. Old, bloated patterns, heavy XML configurations, and verbose boilerplate classes are relics of the past. We mandate the use of **Java 21** and **Spring Boot 3+** along with modern language primitives to write clean, concurrent, and highly performant backend services.

---

## ⚡ Project Loom & Virtual Threads

Traditionally, Java web applications (like Spring Boot using Tomcat) operate on a **Thread-per-Request** model. Because platform threads map 1:1 to OS kernel threads, they are heavy (consuming ~1MB of memory each). Under heavy load, blocking operations (like database queries or external API calls) keep these kernel threads idle, leading to thread exhaustion.

**Java 21 Virtual Threads (Project Loom)** solve this. They are lightweight threads managed by the JVM runtime, not the OS. They cost almost nothing in memory, and blocking operations simply detach the virtual thread from the carrier thread, allowing other virtual tasks to execute.

```
Tomcat Request Thread Pool (Traditional):
[ Request ] ──> [ Kernel Thread (Blocked on SQL) ] ──> [ DB Server ] (Thread exhausted under load)

Virtual Threads (Loom):
[ Request ] ──> [ Virtual Thread (Blocked on SQL) ] ──> (Detached from Carrier, JVM runs other work!)
```

### Enforcing Virtual Threads in Spring Boot 3.2+:
We enforce virtual thread execution globally by adding a single property configuration:

```properties
# src/main/resources/application.properties
spring.threads.virtual.enabled=true
```

With this enabled, Tomcat will spin up a new Virtual Thread for every incoming HTTP request, enabling massive request throughput without requiring complex reactive programming (like Spring WebFlux/RxJava).

---

## 🧱 Modern Language Primitives

We write clean, semantic Java by utilizing modern syntax primitives instead of heavy boilerplate or external libraries like Lombok.

### 1. Immutable Records (DTOs)
Use Java `record` declarations for all data carriers, API payloads, and DTOs. They are immutable by default, thread-safe, and require zero boilerplate.

```java
// 🟢 Modern, Clean Immutable DTO
public record CreateInvoiceRequest(
    @NotNull UUID customerId,
    @Positive BigDecimal amount,
    @NotBlank String billingAddress
) {}
```

### 2. Sealed Classes and Interfaces
Sealed interfaces allow you to restrict which classes can implement them, creating tight, mathematically safe domain models (Algebraic Data Types).

```java
public sealed interface PaymentStatus permits Paid, Pending, Failed {}

public record Paid(BigDecimal amount, Instant paidAt) implements PaymentStatus {}
public record Pending() implements PaymentStatus {}
public record Failed(String errorCode, String errorMessage) implements PaymentStatus {}
```

### 3. Pattern Matching in Switch Blocks
Combine sealed interfaces with pattern matching to write clean, type-safe polymorphic business logic.

```java
public BigDecimal calculateProcessFee(PaymentStatus status) {
    return switch (status) {
        case Paid paid -> paid.amount().multiply(BigDecimal.valueOf(0.02));
        case Pending p -> BigDecimal.ZERO;
        case Failed failed -> BigDecimal.valueOf(5.00); // Penalty fee
    }; // Compiler enforces that all permitted permits are covered!
```

---

## 🍃 Spring Boot 3+ REST Standards

### 1. Declarative REST Clients
We deprecate the use of `RestTemplate` or heavy `Feign` clients. We standardize on Spring Boot 3's **`RestClient`** combined with declarative **`@HttpExchange`** interfaces for calling external services.

```java
// 1. Declare API Contract Interface
public interface PaymentGatewayClient {
    @PostExchange("/charges")
    ChargeResponse processCharge(@RequestBody ChargeRequest request);
}

// 2. Configure Client Proxy in Application Configuration
@Configuration
public class ClientConfig {
    @Bean
    public PaymentGatewayClient paymentGatewayClient() {
        RestClient restClient = RestClient.builder()
            .baseUrl("https://api.paymentgateway.com/v1")
            .defaultHeader("Authorization", "Bearer secret-key")
            .build();
            
        RestClientAdapter adapter = RestClientAdapter.create(restClient);
        HttpServiceProxyFactory factory = HttpServiceProxyFactory.builderFor(adapter).build();
        return factory.createClient(PaymentGatewayClient.class);
    }
}
```

### 2. Avoid Asynchronous WebFlux Streams
Following our core reactivity guidelines, **avoid Spring WebFlux (Project Reactor)** for typical business applications. Writing reactive code (`Mono`/`Flux`) introduces high cognitive load, complex stack traces, and makes debugging exceptionally difficult. 

With Virtual Threads enabled, standard **Spring Web (Tomcat/Servlet)** blocking code is highly concurrent, performant, and significantly easier to write and maintain.
