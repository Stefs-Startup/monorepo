# Enterprise Full-Stack Best Practices

Welcome to the **Enterprise Full-Stack Best Practices** portal. This resource serves as the company-wide unified blueprint for architecting, writing, and maintaining high-performance, resilient, and scalable software systems across our entire engineering stack.

In modern enterprise environments, frontends and backends are not disconnected silos. They are integrated halves of a singular business machine. Achieving top-tier software quality requires that identical architectural themes—modularity, reactivity, strict boundary safety, and deep telemetry—be enforced symmetrically across both layers.

```
                  ┌──────────────────────────────────────────────┐
                  │    Enterprise Full-Stack Best Practices      │
                  └──────┬────────────────────────────────┬──────┘
                         │                                │
                         ▼                                ▼
            ┌────────────────────────┐      ┌────────────────────────┐
            │   Angular (Frontend)   │      │     Java (Backend)     │
            └───────────┬────────────┘      └────────────┬───────────┘
                        │                                │
                        └───────────────┬────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │ Full-Stack OpenAPIs   │
                            └───────────────────────┘
```

---

## 🗺️ Symmetric Themes Overview

| Architectural Theme | Angular (Frontend) | Java (Backend) |
| :--- | :--- | :--- |
| **1. Modular Architecture** | [DDD Library Pillars](enterprise-architecture.md) (Feature/UI/Data/Util) | [Hexagonal Architecture](java-architecture.md) (Ports & Adapters) |
| **2. Modern Standards** | [Signals & Standalone](modern-angular.md) (Fine-grained UI flow) | [Virtual Threads (Loom)](java-standards.md) (Spring Boot 3 REST clients) |
| **3. Strict Boundaries** | [ESLint & Encapsulation](strict-boundaries.md) (Banned deep imports) | [ArchUnit Tests](java-boundaries.md) (Package-private structures) |
| **4. Deep Observability** | [OTel & Custom Error Handler](telemetry-observability.md) (UX / RUM) | [W3C Correlation & RFC 7807](java-telemetry.md) (Distributed Tracing) |
| **5. Standardized Testing** | [Jest & Playwright E2E](testing-ci-cd.md) (DOM accessibility) | [Testcontainers DB Isolation](java-testing.md) (Docker Postgres/Kafka) |

---

## 🔗 Combined Stack Integration

To completely eliminate manual API alignment overhead and prevent typing drift, our frontend and backend are bound together by an automated, contract-first compilation pipeline.

*   **[API Contracts & TypeScript CodeGen](fullstack-integration.md)**: We generate TypeScript interfaces and Angular API services directly from Spring's OpenAPI Swagger specs.
*   **[Dual-Layer Validation](fullstack-integration.md#dual-layer-validation-alignment)**: We align Angular reactive form validators directly with JSR-380 backend validation structures.

---

## 📚 Developer Onboarding & Rosetta Stone

Are you a **React, Node, or Backstage** developer onboarding onto our Angular + Java stack?
*   **[Rosetta Stone Translation Guide](stack-translation.md)**: Instantly map React states, hooks, and props to Angular Signals, Injectable Services, and Inputs/Outputs. Learn how to translate raw Express routers, Winston logs, and Knex queries directly to Spring Boot REST Controllers, Logback MDC, and Spring Data JPA.

---

## 🚀 Navigation Guide

Use the sidebar navigation to drill down into the detailed standards, configurations, and code blueprints for each layer.

