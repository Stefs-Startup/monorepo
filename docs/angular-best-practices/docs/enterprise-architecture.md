# Enterprise Architecture

Large-scale enterprise Angular applications require a architecture that enables parallel development by multiple teams, maintains a clear separation of concerns, and prevents code from rotting into an untraceable "spaghetti" monolith.

Our architecture is based on **Domain-Driven Design (DDD)** combined with a **Strict 4-Tier Library Structure** within a monorepo workspace.

---

## 🏛️ Domain-Driven Design (DDD)

We organize our codebase vertically into business **domains**. A domain represents a specific boundary of business logic (e.g., `billing`, `catalog`, `user-profile`, `analytics`).

```
apps/
  └── customer-portal/          # Deployable application shell
docs/
packages/                       # Shared platform libraries
libs/                           # Domain-specific libraries
  ├── billing/                  # Billing Domain
  │     ├── feature-invoice/    # Feature library (Invoice details)
  │     ├── data-access/        # Billing API and state
  │     └── ui-invoice-card/    # Reusable Invoice UI card
  └── user-profile/             # User Profile Domain
        ├── feature-settings/   # Profile settings page
        └── data-access/        # Profile API clients
```

### Domain Rules:
1.  **Apps are Shells**: Applications under `apps/` are lightweight entry points (shells) containing routing configurations, main index.html files, and telemetry initializers. They contain *no business logic*.
2.  **Domains Contain Libraries**: All real logic, components, and utilities are housed in small, modular **libraries** under domains.
3.  **Strict Isolation**: A domain library must not directly import code from another domain unless that code has been explicitly exposed through a shared platform or designated API contract.

---

## 🧱 The 4 Pillars of Library Categories

To enforce modularity and ensure developers know exactly where to put a new piece of code, we categorize every library into one of four distinct technical tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Application                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          1. Feature Libraries                          │
│        (Smart Components, Routable Views, Business Workflows)          │
└───────────┬───────────────────────┬──────────────────────┬─────────────┘
            │                       │                      │
            ▼                       ▼                      ▼
┌───────────────────────┐ ┌───────────────────┐ ┌──────────────────────┐
│    2. UI Libraries    │ │  3. Data-Access   │ │  4. Util Libraries   │
│ (Dumb Components, UI) │ │ (APIs, State, WS) │ │(Helpers, Pipes, etc) │
└───────────────────────┘ └───────────────────┘ └──────────────────────┘
```

| Library Type | Business Logic? | Routed? | Handles HTTP/State? | Allowed Imports |
| :--- | :--- | :--- | :--- | :--- |
| **1. Feature** | Yes | Yes | Yes | `Feature`, `UI`, `Data-Access`, `Util` |
| **2. UI** | No | No | No | `UI` (shared), `Util` |
| **3. Data-Access**| Yes | No | Yes | `Data-Access` (shared), `Util` |
| **4. Util** | No | No | No | `Util` (only other utils) |

### 1. Feature Libraries (`feature-*`)
Feature libraries house "smart" components. These are responsible for orchestrating user workflows, connecting to data-access layers, managing router interactions, and handling page state.
*   **Best Practice**: Keep feature libraries highly focused. Instead of a single massive `feature-admin` library, break it down into `feature-user-management`, `feature-system-logs`, and `feature-audit-records`.

### 2. UI Libraries (`ui-*`)
UI libraries contain presentational ("dumb") components. They are purely visual, styled, and interactive shells that receive input data via `@Input` (or signal inputs) and emit interactions via `@Output` (or output emitters).
*   **Strict Rule**: UI libraries **must never** inject state services, execute HTTP requests, or reference router parameters. This ensures they are fully reusable and highly testable.

### 3. Data-Access Libraries (`data-access-*`)
Data-Access libraries are the brain of your domain's state. They contain API clients, WebSocket services, State Management structures (Signal Stores, NgRx, or custom RxJS stores), and entity models.
*   **Best Practice**: Define and export clean interfaces for server payloads and internal UI models. Perform necessary data normalization *inside* the data-access service, not in the Feature component.

### 4. Util Libraries (`util-*`)
Util libraries are filled with low-level helpers, formatters, domain-specific validators, custom router guards, and utility directives or pipes.
*   **Best Practice**: Ensure utility functions are pure (deterministic, zero side-effects). They should be easily testable without mock injectors or DOM setups.

---

## 🔀 Monorepo Dependency Direction

To prevent circular dependencies and high coupling, the flow of dependencies in the monorepo must strictly go **one-way**:

> [!IMPORTANT]
> -   **Downwards**: High-level libraries can depend on lower-level libraries (`Feature` -> `Data-Access` -> `Util`).
> -   **Never Upwards**: Low-level libraries (`UI`, `Data-Access`, `Util`) **must never** depend on high-level libraries (`Feature`).
> -   **No Across-Domain Imports**: A library in `billing` cannot import from a `feature` library in `user-profile`. It may only import from a shared data-access or common ui library, using strict boundary rules.
