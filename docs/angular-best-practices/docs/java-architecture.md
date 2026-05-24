# Java Backend Architecture

For large-scale enterprise Java applications, we reject the traditional, tightly coupled 3-tier layering model (Controller -> Service -> DAO/Repository). In traditional layering, database schemas and framework concepts leak directly into business logic, leading to brittle codebases that are difficult to upgrade or test in isolation.

Instead, we mandate **Hexagonal Architecture (Ports & Adapters)** combined with **Domain-Driven Design (DDD)**.

---

## 🛑 The Traditional Layering Trap vs. Hexagonal Architecture

Traditional layering creates a database-centric model where the entity objects map 1:1 to database tables, and the service layer relies heavily on Spring annotations and Hibernate features.

```
Traditional (Brittle & Coupled):
[ REST Controller ] ──> [ Spring Service ] ──> [ Hibernate Entity (DAO) ] ──> [ Database ]
```

Hexagonal Architecture flips this relationship. The pure **Domain Core** sits at the center, completely isolated from databases, web frameworks, and messaging brokers. It communicates with the outside world exclusively through abstract **Ports**:

```
Hexagonal / Ports & Adapters (Decoupled & Pure):
                ┌────────────────────────────────────────────────────────┐
                │                       Application                      │
                │                                                        │
┌───────────┐   │  ┌──────────────┐    ┌────────────┐                    │   ┌──────────────┐
│   REST    │──>│  │ Inbound Port │───>│   Domain   │                    │   │  PostgreSQL  │
│ Adapter   │   │  │  (Use Case)  │    │  Services  │                    │   │   Database   │
└───────────┘   │  └──────────────┘    │  & Rules   │    ┌─────────────┐ │   └──────────────┘
                │                      │            │───>│Outbound Port││──>┌──────────────┐
┌───────────┐   │                      │            │    │(Repository) │ │   │    Kafka     │
│   Event   │──>│                      └────────────┘    └─────────────┘ │   │    Broker    │
│  Adapter  │   │                                                        │   └──────────────┘
└───────────┘   └────────────────────────────────────────────────────────┘
```

### 1. The Domain Core (`domain`)
The domain layer represents your core business logic, policies, aggregates, entities, and value objects.
*   **Strict Rule**: The domain layer must be **100% framework-free**. It must not import annotations or libraries from Spring, Hibernate, JPA, Jackson, or any other infrastructure framework. It relies solely on core Java.

### 2. Inbound and Outbound Ports
*   **Inbound Ports (Use Cases)**: Interfaces defined by the application layer that describe what external clients can do (e.g. `CreateInvoiceUseCase`).
*   **Outbound Ports (SPIs)**: Interfaces defined by the application layer that describe what the application needs to interact with the outside world (e.g. `InvoiceRepositoryPort`, `PaymentGatewayPort`).

### 3. Adapters
Adapters implement the ports or trigger inbound ports.
*   **Inbound Adapters**: HTTP controllers, Kafka/RabbitMQ consumers, or CLI handlers that receive inputs, map them to domain objects, and invoke an Inbound Port.
*   **Outbound Adapters**: Spring Data JPA repositories, REST API clients, or event publishers that implement an Outbound Port to write to database servers or make network requests.

---

## 📁 Gradle Multi-Project Layout

We enforce physical separation of architectural zones using **Gradle multi-project builds** (or Maven multi-modules). This prevents developers from accidentally referencing DB repositories inside domain entities.

```
billing-service/
  ├── build.gradle.kts
  ├── settings.gradle.kts
  ├── billing-domain/                  # Core Business Entities (Zero Framework Dependencies)
  ├── billing-application/             # Ports & Use Cases (Only depends on billing-domain)
  ├── billing-adapter-in-web/          # Spring REST controllers (Depends on application)
  ├── billing-adapter-out-persistence/ # Spring Data JPA & DB Schemas (Depends on application)
  └── billing-bootstrap/               # Configuration, Spring Boot Main (Assembles the hexagon)
```

### Dependency Flow Directions:
*   `billing-domain` depends on: *Nothing*
*   `billing-application` depends on: `billing-domain`
*   `billing-adapter-in-web` depends on: `billing-application`
*   `billing-adapter-out-persistence` depends on: `billing-application`
*   `billing-bootstrap` depends on: `billing-adapter-in-web`, `billing-adapter-out-persistence`
