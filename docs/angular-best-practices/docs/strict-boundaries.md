# Strict Boundary Enforcement

In large enterprise teams, "architecture drift" occurs when developers bypass modularity patterns to deliver features faster. Over time, this leads to cyclical dependencies, massive bundles, and a brittle codebase where a change in one domain breaks a seemingly unrelated feature elsewhere.

We mitigate these risks using **Strict Boundary Definitions** enforced through lint rules, compile checks, and strict encapsulation.

---

## 🔒 Public APIs and Barrel Files

Every library in the monorepo must have a single entry point: a **public API barrel file** (`index.ts`) at its root. 

```
libs/billing/data-access/
  ├── src/
  │    ├── lib/
  │    │    ├── billing-api.service.ts
  │    │    ├── state.store.ts
  │    │    └── secret-helper.ts          # Internal, not exported
  │    └── index.ts                       # Public API
```

### The Barrel File Rule:
*   **Only export what is needed**: The `index.ts` should export only the public contracts, services, and components that other libraries need.
*   **Encapsulate implementation details**: Internal helper functions, private state tokens, or minor presentational sub-components must **never** be exported in the `index.ts`.
*   **Banned Deep Imports**: Developers must never import internal files directly.
    *   🔴 **BANNED**: `import { SecretHelper } from '@cmp/billing/data-access/src/lib/secret-helper';`
    *   🟢 **ALLOWED**: `import { BillingService } from '@cmp/billing/data-access';`

---

## 📐 Enforcing Library Boundaries with ESLint

We use modular boundaries to automate architectural rules. These boundaries ensure low coupling and high cohesion across our codebase.

Here is how we configure and enforce ESLint rules (such as `@nx/enforce-module-boundaries` or standard monorepo boundaries):

```json
// .eslintrc.json (Project Boundary Rules)
{
  "rules": {
    "@nx/enforce-module-boundaries": [
      "error",
      {
        "enforceBuildableLibDependency": true,
        "allow": [],
        "depConstraints": [
          {
            "sourceTag": "type:app",
            "onlyDependOnLibsWithTags": ["type:feature", "type:ui", "type:data-access", "type:util"]
          },
          {
            "sourceTag": "type:feature",
            "onlyDependOnLibsWithTags": ["type:ui", "type:data-access", "type:util"]
          },
          {
            "sourceTag": "type:ui",
            "onlyDependOnLibsWithTags": ["type:ui", "type:util"]
          },
          {
            "sourceTag": "type:data-access",
            "onlyDependOnLibsWithTags": ["type:data-access", "type:util"]
          },
          {
            "sourceTag": "type:util",
            "onlyDependOnLibsWithTags": ["type:util"]
          }
        ]
      }
    ]
  }
}
```

### Dependency Rules Summary:
1.  **Apps** are at the top and can depend on anything.
2.  **Features** can depend on UI, Data-Access, and Utilities. They *cannot* depend on other Features. This prevents high coupling between distinct business screens.
3.  **UI Components** can only depend on other UI libraries (e.g. shared design system elements) and low-level utilities. They are strictly *dumb*—no state injections.
4.  **Data-Access** can only depend on other data-access APIs and utilities. They *cannot* depend on visual components.
5.  **Utils** are highly modular pure libraries that cannot depend on anything but other utilities.

---

## 🔍 TypeScript Strict Compiler Settings

To eliminate common runtime errors like `TypeError: Cannot read properties of undefined` in production, we mandate TypeScript strict mode.

Every `tsconfig.json` across the workspace must inherit these compiler options:

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Crucial Directives:

*   **`strictNullChecks`**: Forces you to explicitly declare if a variable can be null or undefined, prompting you to write optional chaining (`?.`) or fallback nullish coalescing (`??`) operations.
*   **`strictPropertyInitialization`**: Ensures every class property is initialized in the constructor, declared with an initial value, or explicitly marked as optional/nullable.
*   **`noImplicitAny`**: Bans declarations that default to the `any` type. Developers must define strict models and interfaces.

> [!CAUTION]
> The use of `any` is an anti-pattern. If a type is truly variable, use `unknown` and perform type-narrowing (e.g. via type guards or `typeof` assertions). If a third-party library returns untyped data, map it to a typed schema at the data-access layer.
