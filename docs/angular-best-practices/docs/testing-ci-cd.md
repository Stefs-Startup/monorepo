# Testing & CI/CD

Enterprise Angular applications require automated quality assurance gates. Code reviews are human-driven and error-prone; we delegate as much validation as possible to our Continuous Integration (CI) systems to ensure high software quality.

---

## 🧪 The Testing Pyramid

We standardize our testing efforts across three distinct tiers to optimize speed, cost, and confidence:

```
           / \
          /   \
         / E2E \    <-- Playwright (High confidence, slow, expensive)
        /-------\
       / Compon  \   <-- Angular Testing Library (User interactions, medium speed)
      /-----------\
     /   Unit      \  <-- Jest / Vitest (Logic, helper, APIs, state, fast, cheap)
    /_______________\
```

### 1. Unit Testing (Jest / Vitest)
*   **Target**: Utilities, pure helpers, state stores, custom services, data mappers, and custom pipes.
*   **Rules**:
    *   Do not mock the DOM in unit tests unless absolutely necessary.
    *   Mock all external HTTP services. Never let unit tests attempt actual network requests.
    *   Aim for **90%+ test coverage** on utilities and data-access services.

### 2. Component Testing (Angular Testing Library)
*   **Target**: Feature smart components and UI components.
*   **Rules**:
    *   We use **Angular Testing Library** over standard Angular `TestBed` queries to query elements by accessibility roles rather than brittle CSS classes or internal HTML structures.
    *   🟢 **DO**: `screen.getByRole('button', { name: /save invoice/i })`
    *   🔴 **AVOID**: `fixture.debugElement.query(By.css('.btn-save-primary'))`

### 3. End-to-End Testing (Playwright)
*   **Target**: Critical, high-value user journeys (e.g., User Login, Checkout flows, Dashboard configuration).
*   **Rules**:
    *   E2E tests run in containers against a deployed staging or containerized local instance.
    *   Keep E2E tests focused on integration, checking only major paths and failure modes.

---

## 🚦 CI/CD Quality Gates

Every Pull Request must pass through automated pipelines before merging is allowed. The CI pipeline executes the following checks in parallel:

```
                             Pull Request
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
     1. Lint & Format       2. Typecheck               3. Tests
   (Prettier / ESLint)         (tsc)             (Jest / Playwright)
```

1.  **Format Check**: Validates code with `prettier --check .`.
2.  **Linter Gate**: Runs ESLint rules, enforcing style guides and `@nx/enforce-module-boundaries`.
3.  **Typecheck**: Compiles TS files using `tsc --noEmit` to catch compile errors.
4.  **Test Suite**: Executes all unit and component tests.
5.  **Bundle Budgets**: Validates bundle size budgets (detailed below).

---

## 📦 Bundle Budgets & Size Controls

To prevent slow page loads caused by massive dependencies, we configure strict **Bundle Budgets** in our workspace build settings. If a build exceeds the budget, the CI runner will fail the build automatically.

```json
// angular.json / build configurations
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "250kB",
    "maximumError": "500kB"
  },
  {
    "type": "anyComponentStyle",
    "maximumWarning": "2kB",
    "maximumError": "4kB"
  }
]
```

### Bundle Management Best Practices:
-   **Analyze Bloat**: If a bundle size warning occurs, use bundle visualization tools (like `esbuild-visualizer` or `webpack-bundle-analyzer`) to trace where the weight is coming from.
-   **Avoid Wildcard Imports**: Never import an entire heavy library if you only require one utility from it.
-   **Lazy-load Heavy Assets**: Leverage route-based lazy loading and `@defer` blocks to keep the initial page bundle as lightweight as possible.

---

## 🔒 Dependency Safety

To maintain stability, we pin library versions strictly:

> [!CAUTION]
> -   **No Wildcards**: Do not use `^` or `~` wildcards for critical packages in `package.json` where updates might introduce breaking API modifications.
> -   **Strict Lockfiles**: Enforce lockfile synchronization (`pnpm-lock.yaml` or `yarn.lock`). If a lockfile doesn't match the package requirements, fail CI.
> -   **Regular Audits**: Run `pnpm audit` or automated tools (like Renovate or Dependabot) to proactively track and patch vulnerabilities in dependencies.
