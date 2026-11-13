# Spring Enterprise: Spring MVC Pipeline & Global Exception Handling

Spring MVC processes incoming HTTP requests, binds inputs to domain objects, executes business controllers, serializes JSON responses, and handles exceptions cleanly. In enterprise production systems, standardizing the HTTP pipeline and implementing RFC 7807 compliant error handling is vital for robust front-end integration.

---

## 🧭 1. The `DispatcherServlet` Request Pipeline

Every HTTP request targeted at a Spring Web application flows through `DispatcherServlet`, the Front Controller pattern implementation in Spring.

```
Incoming Request
       │
       ▼
DispatcherServlet
       │
       ├── 1. HandlerMapping.getHandler() ──> Resolves target Controller method
       │
       ├── 2. HandlerInterceptor.preHandle() ──> Executes pre-processing filters
       │
       ├── 3. HandlerAdapter.handle()
       │      ├── Resolves method arguments (PathVariable, RequestBody)
       │      ├── HttpMessageConverter (Jackson JSON Deserialization)
       │      └── Invokes Controller Method
       │
       ├── 4. HandlerInterceptor.postHandle() ──> Post-controller execution
       │
       ├── 5. HttpMessageConverter ──> Serializes Return Value to JSON
       │
       └── 6. HandlerInterceptor.afterCompletion() ──> Cleanup / MDC clearing
```

---

## 🛑 2. Filters vs Interceptors

| Feature | Servlet Filter (`OncePerRequestFilter`) | Handler Interceptor (`HandlerInterceptor`) |
| :--- | :--- | :--- |
| **Layer** | Servlet Container level (Before Spring MVC). | Spring MVC Framework level (Inside `DispatcherServlet`). |
| **Context** | Access to raw `HttpServletRequest` & `HttpServletResponse`. | Access to target `Object handler` (Controller method metadata). |
| **Spring Awareness** | Can use Spring DI, but runs outside Spring MVC exception handling. | Integrated into Spring MVC exception handling flow. |
| **Use Cases** | Security filtering, request logging, gzip decompression, CORS headers. | Request timing, user permissions check, tenant ID extraction into MDC. |

### Production HandlerInterceptor Blueprint (Tenant ID Extraction & Logging MDC)

```java
package com.company.billing.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.UUID;

@Component
public class TenantContextInterceptor implements HandlerInterceptor {

    private static final String TENANT_HEADER = "X-Tenant-ID";
    private static final String CORRELATION_HEADER = "X-Correlation-ID";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String tenantId = request.getHeader(TENANT_HEADER);
        String correlationId = request.getHeader(CORRELATION_HEADER);

        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }

        MDC.put("tenantId", tenantId != null ? tenantId : "ANONYMOUS");
        MDC.put("correlationId", correlationId);
        response.setHeader(CORRELATION_HEADER, correlationId);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        MDC.clear(); // MANDATORY: Prevent ThreadLocal memory leaks in Servlet thread pools!
    }
}
```

---

## ⚠️ 3. Global Exception Handling (RFC 7807 `ProblemDetail`)

Starting in Spring 6 / Spring Boot 3, Spring supports **RFC 7807 (Problem Details for HTTP APIs)** natively using `ProblemDetail`. This provides a standard JSON format for conveying machine-readable error details to frontends like Angular.

```json
{
  "type": "https://api.company.com/errors/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 400,
  "detail": "Account balance of $50.00 is insufficient for transaction of $120.00",
  "instance": "/api/v1/accounts/acc-123/withdraw",
  "timestamp": "2026-08-22T18:00:00Z",
  "invalidParams": [
    { "field": "amount", "reason": "Amount exceeds current balance" }
  ]
}
```

### Production `@RestControllerAdvice` Blueprint

```java
package com.company.billing.exception;

import com.company.billing.exception.InsufficientFundsException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.time.Instant;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    // 1. Handle Domain Business Exception
    @ExceptionHandler(InsufficientFundsException.class)
    public ProblemDetail handleInsufficientFunds(InsufficientFundsException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setTitle("Insufficient Funds");
        problem.setType(URI.create("https://api.company.com/errors/insufficient-funds"));
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    // 2. Handle JSR-380 Request Body Validation Errors
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidationError(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, "Validation failed");
        problem.setTitle("Invalid Request Content");
        problem.setType(URI.create("https://api.company.com/errors/validation-failed"));

        List<FieldErrorRecord> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> new FieldErrorRecord(err.getField(), err.getDefaultMessage()))
                .toList();

        problem.setProperty("invalidParams", fieldErrors);
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    // 3. Fallback Exception Handler for Unhandled Exceptions
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnhandled(Exception ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected system error occurred");
        problem.setTitle("Internal Error");
        problem.setProperty("timestamp", Instant.now());
        return problem;
    }

    public record FieldErrorRecord(String field, String reason) {}
}
```

---

## 🧪 4. JSR-380 Request Validation (`@Valid` / `@Validated`)

Input validation must be executed at the controller boundary before business logic is invoked.

### Enterprise Request DTO with Annotations

```java
package com.company.billing.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record CreateInvoiceRequest(
    @NotBlank(message = "Customer ID is required")
    String customerId,

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
    BigDecimal amount,

    @NotBlank(message = "Currency code is required")
    @Pattern(regexp = "^[A-Z]{3}$", message = "Currency must be a 3-letter ISO code")
    String currency
) {}
```

### Controller Usage

```java
@PostMapping("/invoices")
public ResponseEntity<InvoiceResponse> createInvoice(
    @Valid @RequestBody CreateInvoiceRequest request // Trigger JSR-380 validation!
) {
    InvoiceResponse response = invoiceService.createInvoice(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
}
```
