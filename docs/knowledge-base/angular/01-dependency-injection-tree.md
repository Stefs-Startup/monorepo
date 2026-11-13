# Angular Enterprise: Dependency Injection & Hierarchical Injectors

Angular features a powerful, hierarchical Dependency Injection (DI) system. In enterprise-scale applications, mastering how Angular creates, searches, scopes, and resolves dependencies across the injector tree is essential for memory management, module isolation, and clean architecture.

---

## 🌳 1. The Dual Injector Hierarchy: `ModuleInjector` vs `ElementInjector`

Angular's DI engine does not consist of a single global container. It maintains **two distinct injector trees** that work together to resolve dependencies:

```
                          ┌────────────────────────┐
                          │    NullInjector        │ (Throws "No provider for X!")
                          └───────────▲────────────┘
                                      │
                          ┌───────────┴────────────┘
                          │   PlatformInjector     │ (Shared across multi Angular apps on page)
                          └───────────▲────────────┘
                                      │
                          ┌───────────┴────────────┘
                          │ Root ModuleInjector    │ (providedIn: 'root' / ApplicationConfig)
                          └───────────▲────────────┘
                                      │
 ┌────────────────────────────────────┴────────────────────────────────────┐
 │                                                                         │
 │  ElementInjector Tree (Follows Component DOM Structure):                │
 │                                                                         │
 │                        ┌───────────────────────┐                        │
 │                        │ AppComponent Injector │                        │
 │                        └───────────▲───────────┘                        │
 │                                    │                                    │
 │                        ┌───────────┴───────────┐                        │
 │                        │ FeatureShell Injector │                        │
 │                        └───────────▲───────────┘                        │
 │                                    │                                    │
 │                        ┌───────────┴───────────┐                        │
 │                        │ ChildCard Injector    │                        │
 │                        └───────────────────────┘                        │
 └─────────────────────────────────────────────────────────────────────────┘
```

### 1. `ModuleInjector` Tree
*   **Root Level**: Created by `bootstrapApplication(AppComponent, appConfig)` or `AppModule`.
*   **Platform Level**: Ancestor of Root. Manages platform-wide services (e.g. `DomSanitizer`).
*   **Lifecycle**: Singleton for the entire life of the application. Services declared with `providedIn: 'root'` live here.

### 2. `ElementInjector` Tree
*   Created dynamically for every HTML element or component that declares a `providers: [...]` or `viewProviders: [...]` array.
*   Follows the component DOM parent-child hierarchy exactly.
*   **Lifecycle**: Tied directly to the component instance DOM lifetime. When the component is destroyed, all service instances in its `ElementInjector` are destroyed.

---

## 🎯 2. Resolution Rules & Dependency Lookup Flow

When a component or service requests a dependency via `inject(MyService)` or constructor injection:

1. Angular starts searching at the current node's **`ElementInjector`**.
2. If not found, it traverses UP the **`ElementInjector`** parent chain (Parent Component -> Grandparent -> Root Component).
3. If still not found at `AppComponent`, Angular switches over to the **`ModuleInjector`** tree starting at the Root `ModuleInjector`.
4. It traverses up `ModuleInjector` -> `PlatformInjector` -> `NullInjector`.
5. If it reaches `NullInjector` without finding a provider, Angular throws: `NullInjectorError: No provider for MyService!`.

---

## 🛠️ 3. Provider Recipes & `InjectionToken<T>`

TypeScript interfaces are erased during compilation to JavaScript and cannot be used as DI runtime tokens. Use `InjectionToken<T>` to inject interface types, configurations, or primitive values.

### Enterprise Provider Recipes Example

```typescript
import { InjectionToken, inject, Component, Injectable } from '@angular/core';

// 1. Define Typed Injection Token for Interface Configuration
export interface AppConfig {
  apiEndpoint: string;
  timeoutMs: number;
  retryAttempts: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

// 2. Abstract Logger Interface Token
export abstract class LoggerService {
  abstract log(message: String): void;
}

// Concrete Implementations
@Injectable()
public class ConsoleLoggerService extends LoggerService {
  log(message: string) {
    console.log(`[CONSOLE]: ${message}`);
  }
}

@Injectable()
public class CloudLoggerService extends LoggerService {
  log(message: string) {
    // Send to remote telemetry service...
  }
}

// 3. Provider Configuration Object (in app.config.ts)
export const appConfigProviders = [
  // Value Provider Recipe
  {
    provide: APP_CONFIG,
    useValue: {
      apiEndpoint: 'https://api.company.com/v1',
      timeoutMs: 5000,
      retryAttempts: 3,
    },
  },

  // Class Provider Recipe (Swap implementations based on environment)
  {
    provide: LoggerService,
    useClass: environment.production ? CloudLoggerService : ConsoleLoggerService,
  },

  // Factory Provider Recipe with Dependencies
  {
    provide: 'ANALYTICS_SERVICE',
    useFactory: () => {
      const config = inject(APP_CONFIG);
      return new AnalyticsEngine(config.apiEndpoint);
    },
  },
];
```

---

## 🔍 4. Resolution Modifiers & Functional Injection (`inject()`)

Resolution modifiers alter Angular's default lookup path.

| Modifier | Functional Equivalent | Behavior |
| :--- | :--- | :--- |
| **`@Optional()`** | `inject(Service, { optional: true })` | Returns `null` instead of throwing `NullInjectorError` if dependency is missing. |
| **`@Self()`** | `inject(Service, { self: true })` | Only checks the current component's `ElementInjector`. Does NOT search parents. |
| **`@SkipSelf()`** | `inject(Service, { skipSelf: true })` | Skips current component's `ElementInjector` and starts searching at the parent component. |
| **`@Host()`** | `inject(Service, { host: true })` | Stops searching at the host component boundary (useful in custom directives). |

### Enterprise Code Blueprint: Component-Scoped State Isolation (`@SkipSelf`)

In complex tabbed interfaces or nested forms, a parent tab container might provide `TabStateService`. A nested child component may need to access its **parent's** `TabStateService` while ignoring any local service instance.

```typescript
import { Component, inject, Injectable, SkipSelf, Optional } from '@angular/core';

@Injectable()
export class TabStateService {
  public tabId = Math.random().toString(36).substring(7);
}

@Component({
  selector: 'app-nested-tab-panel',
  standalone: true,
  providers: [TabStateService], // Local ElementInjector provider
  template: `
    <div>
      <p>Local Tab ID: {{ localState.tabId }}</p>
      <p>Parent Tab ID: {{ parentState?.tabId || 'No Parent' }}</p>
    </div>
  `
})
export class NestedTabPanelComponent {
  // Local instance provided by this component's ElementInjector
  public localState = inject(TabStateService);

  // Parent instance resolved by skipping local ElementInjector!
  public parentState = inject(TabStateService, { skipSelf: true, optional: true });
}
```

---

## 📦 5. Scoped Services (`providers` vs `viewProviders`)

When building reusable UI library components (e.g. Accordions, Modals, Card groups):

*   **`providers: [MyService]`**: Service is visible to the component AND any projected content passed in via `<ng-content>`.
*   **`viewProviders: [MyService]`**: Service is visible ONLY to the component's internal view template. Projected content inside `<ng-content>` CANNOT access it. This provides strict encapsulation for UI component internal state.

```typescript
@Component({
  selector: 'lib-accordion-item',
  standalone: true,
  viewProviders: [AccordionItemStateService], // Encapsulated! Projected templates can't pollute internal state
  template: `
    <div class="accordion-header" (click)="toggle()">
      <ng-content select="[accordion-title]"></ng-content>
    </div>
    <div class="accordion-body" *ngIf="isOpen()">
      <ng-content></ng-content>
    </div>
  `
})
export class AccordionItemComponent {
  // Internal state protected from projected content tampering
}
```
