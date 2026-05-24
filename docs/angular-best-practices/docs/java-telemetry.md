# Java Telemetry & Observability

Observability on the backend must be seamless and structured. We align our Java services to standard enterprise observability metrics using **Micrometer**, **OpenTelemetry**, and **Unified Error Responses (RFC 7807)**.

---

## 🌐 Distributed Tracing & W3C Trace Context

We mandate **Distributed Tracing** to track requests across our entire technology stack. When an Angular frontend makes an HTTP request, its trace context is sent via a `traceparent` header (following the W3C Trace Context standard).

```
[ Angular Browser ]
   │ Trace-ID: 4bf92f3577b34da6a3ce929d0e0e4736
   ▼
[ Spring REST Controller ]  <-- Intercepts traceparent header
   │ Correlates traceId
   ▼
[ Logback SLF4J MDC ]       <-- Inject trace_id into JSON log outputs
   │ Propagation
   ▼
[ Database Query / Kafka ]   <-- Downstream tracking
```

### Automatic Context Capture:
We utilize the Spring Boot 3 Actuator and Micrometer Tracing bridge to capture, process, and forward trace contexts to our OTel Collector.

```xml
<!-- pom.xml / build.gradle.kts dependencies -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
```

### Logback Correlation Configuration:
Every structured log statement must automatically output the active `traceId` and `spanId` using Mapped Diagnostic Context (MDC):

```xml
<!-- src/main/resources/logback-spring.xml -->
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="ch.qos.logstash.logback.encoder.LoggingEventCompositeJsonEncoder">
            <providers>
                <timestamp/>
                <logLevel/>
                <threadName/>
                <loggerName/>
                <message/>
                <mdc/> <!-- Injects traceId, spanId automatically! -->
                <stackTrace/>
            </providers>
        </encoder>
    </appender>
</configuration>
```

Output Structured JSON Log:
```json
{
  "@timestamp": "2026-05-22T23:55:00.123Z",
  "level": "INFO",
  "thread": "virtual-12",
  "logger": "com.company.billing.domain.service.InvoiceService",
  "message": "Successfully compiled invoice for transaction",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7"
}
```

---

## 🚨 Standardized Global Exception Handling (RFC 7807)

Spring Boot's default white-label error page is a massive security risk. Leaking Java class names, Hibernate query syntax, or database exception stack traces allows attackers to understand the internal construction of your app.

We mandate the use of **RFC 7807 (Problem Details for HTTP APIs)** for all uncaught backend exceptions.

### Creating the Unified Global Exception Handler:

```java
// billing-adapter-in-web/src/main/java/com/company/billing/adapter/in/web/GlobalExceptionHandler.java
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import java.net.URI;
import java.time.Instant;

@ControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    // 1. Map Custom Business Logic Exceptions (Domain)
    @ExceptionHandler(CustomerNotFoundException.class)
    public ResponseEntity<ProblemDetail> handleCustomerNotFound(CustomerNotFoundException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, 
            ex.getMessage()
        );
        problemDetail.setTitle("Customer Resource Not Found");
        problemDetail.setType(URI.create("https://api.company.com/errors/not-found"));
        problemDetail.setProperty("timestamp", Instant.now());
        
        return new ResponseEntity<>(problemDetail, HttpStatus.NOT_FOUND);
    }

    // 2. Map Uncaught Runtime/DB Exceptions (Enrich and hide stack trace)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleAllUncaughtExceptions(Exception ex) {
        // Enforce structured logging of the stack trace inside the server log
        logger.error("An uncaught application exception occurred: ", ex);

        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "An unexpected internal error occurred. Please contact customer support."
        );
        problemDetail.setTitle("Internal Server Error");
        problemDetail.setType(URI.create("https://api.company.com/errors/internal-server-error"));
        problemDetail.setProperty("timestamp", Instant.now());

        // Return clean JSON to client, protecting sensitive database details
        return new ResponseEntity<>(problemDetail, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
```

### JSON Response Format (RFC 7807):
```json
{
  "type": "https://api.company.com/errors/not-found",
  "title": "Customer Resource Not Found",
  "status": 404,
  "detail": "Customer with ID 7a82-bc10 has no active billing record.",
  "instance": "/invoices/create",
  "timestamp": "2026-05-22T23:55:04.456Z"
}
```
This standardized error JSON format is immediately readable by frontend API services, ensuring consistent error parsing across every company application.
