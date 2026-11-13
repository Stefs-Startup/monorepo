# Spring Enterprise: Spring Security Architecture & SPA Integration

Spring Security provides authentication, authorization, and protection against common exploits (CSRF, CORS, session fixation). In modern enterprise applications, Spring Security acts as a **Stateless OAuth2 / JWT Resource Server** serving single-page application (SPA) frontends like Angular.

---

## 🛡️ 1. The `SecurityFilterChain` Architecture

Spring Security hooks into the Servlet Container (Tomcat/Jetty) using a single Servlet Filter called `DelegatingFilterProxy`.

```
Incoming HTTP Request
          │
          ▼
┌────────────────────────────────────────────────────────┐
│                   Servlet Container                    │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │             DelegatingFilterProxy              │   │
│   └───────────────────────┬────────────────────────┘   │
└───────────────────────────┼────────────────────────────┘
                            │ Delegates to Spring ApplicationContext
                            ▼
┌────────────────────────────────────────────────────────┐
│                   FilterChainProxy                     │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │            SecurityFilterChain (List)          │   │
│   │                                                │   │
│   │  1. CorsFilter                                 │   │
│   │  2. CsrfFilter                                 │   │
│   │  3. HeaderWriterFilter                         │   │
│   │  4. BearerTokenAuthenticationFilter (JWT)     │   │
│   │  5. ExceptionTranslationFilter                 │   │
│   │  6. AuthorizationFilter                        │   │
│   └───────────────────────┬────────────────────────┘   │
└───────────────────────────┼────────────────────────────┘
                            │ Authorized
                            ▼
                     Spring Controller
```

### Key Components:
1.  **`DelegatingFilterProxy`**: Standard Servlet Filter configured in `web.xml` or Spring Boot auto-config. It bridges Servlet container lifecycles to Spring's `ApplicationContext`.
2.  **`FilterChainProxy`**: The central Spring bean holding a list of `SecurityFilterChain` instances matched by RequestMatcher patterns.
3.  **`SecurityFilterChain`**: A sequential ordering of Spring Security Filters that process the request before reaching Spring MVC controllers.

---

## 🔑 2. Authentication Flow & `SecurityContextHolder`

Authentication is the process of establishing the identity of the principal making the request.

```
       UsernamePasswordAuthenticationToken / BearerToken
                             │
                             ▼
                  AuthenticationManager
                             │
                             ▼
                 AuthenticationProvider (e.g. JwtAuthenticationProvider)
                             │ Validates token & loads authorities
                             ▼
                Authentication (Authenticated=true)
                             │
                             ▼
              SecurityContextHolder.getContext()
             .setAuthentication(authentication);
```

### `SecurityContextHolder` & Storage Strategies
The `SecurityContextHolder` stores details of the currently authenticated user in a `SecurityContext`.

*   **`MODE_THREADLOCAL`** *(Default)*: Stores `SecurityContext` in a `ThreadLocal`. Every incoming HTTP worker thread has its own context.
*   **`MODE_INHERITABLETHREADLOCAL`**: Inherits context to child threads created by the parent thread.
*   **`MODE_GLOBAL`**: Shared globally across all threads (used in desktop or standalone applications).

#### Accessing Authenticated User in Code:

```java
package com.company.billing.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class SecurityUtils {

    public Optional<String> getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return Optional.ofNullable(jwt.getSubject());
        }
        return Optional.empty();
    }
}
```

---

## 🔒 3. Method Security & Authorization (`@PreAuthorize`)

Declarative method security protects internal services independently of REST endpoints.

Enable method security with `@EnableMethodSecurity`:

```java
package com.company.billing.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@Configuration
@EnableMethodSecurity(prePostEnabled = true, securedEnabled = true)
public class SecurityConfig {
}
```

### Enterprise Authorization Annotations

```java
package com.company.billing.service;

import com.company.billing.model.Invoice;
import org.springframework.security.access.prepost.PostAuthorize;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class InvoiceService {

    // Pre-execution evaluation: Role check
    @PreAuthorize("hasRole('ROLE_FINANCE_ADMIN') or hasAuthority('SCOPE_invoice:write')")
    public Invoice createInvoice(Invoice invoice) {
        return invoice;
    }

    // Dynamic SpEL evaluation checking parameters
    @PreAuthorize("#tenantId == authentication.tokenAttributes['tenant_id']")
    public void deleteInvoice(UUID invoiceId, String tenantId) {
        // ...
    }

    // Post-execution evaluation: Inspect returned object
    @PostAuthorize("returnObject.ownerId == authentication.name or hasRole('ROLE_ADMIN')")
    public Invoice getInvoiceById(UUID invoiceId) {
        return new Invoice(invoiceId, "user-123");
    }
}
```

---

## 🌐 4. Production Security Configuration: OAuth2 / JWT Resource Server + Angular Integration

Here is a complete, production-grade Spring Security 6+ configuration class supporting:
- Stateless JWT validation.
- Angular Cookie-based CSRF protection (`CookieCsrfTokenRepository`).
- Strict CORS rules.
- Public endpoint exemptions.

```java
package com.company.billing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfiguration {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // SPA CSRF Token Handler (Supports Angular XSRF-TOKEN cookie header)
        CsrfTokenRequestAttributeHandler requestHandler = new CsrfTokenRequestAttributeHandler();
        requestHandler.setCsrfRequestAttributeName("_csrf");

        http
            // 1. CORS Configuration
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // 2. Stateless Session Management
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // 3. CSRF Protection for SPAs
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()) // Exposes XSRF-TOKEN cookie to Angular
                .csrfTokenRequestHandler(requestHandler)
                .ignoringRequestMatchers("/api/v1/webhooks/**", "/actuator/**") // Ignore webhooks
            )

            // 4. Endpoint Authorization Rules
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/v1/public/**").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )

            // 5. JWT Resource Server Validation
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> {}));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://app.company.com", "http://localhost:4200"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN"));
        config.setExposedHeaders(List.of("X-XSRF-TOKEN"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

---

## 🍪 5. Angular CSRF / XSRF Handshake Integration

Spring Security's `CookieCsrfTokenRepository.withHttpOnlyFalse()` sets a cookie named `XSRF-TOKEN` on HTTP responses.

Angular's `HttpClient` automatically reads the `XSRF-TOKEN` cookie value and includes it in an HTTP header named `X-XSRF-TOKEN` on modifying requests (`POST`, `PUT`, `DELETE`).

```
Spring Backend                                       Angular Frontend
      │                                                     │
      │ ── HTTP GET Response (Set-Cookie: XSRF-TOKEN=xyz) ─►│
      │                                                     │ (Angular HttpClient automatically
      │                                                     │  reads cookie and appends header)
      │ ◄─ HTTP POST /api/data (Header: X-XSRF-TOKEN=xyz) ──│
      │                                                     │
```
