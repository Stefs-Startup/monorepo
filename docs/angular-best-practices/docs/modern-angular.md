# Modern Angular (17/18+)

Modern Angular has undergone a massive renaissance, shedding old boilerplate (like `NgModule`) and introducing powerful, performance-oriented primitives. We mandate the use of modern Angular APIs for all new enterprise features.

---

## ⚡ Signals-First Reactivity

Signals are a reactive primitive that provides fine-grained, synchronous reactivity. Unlike Zone.js, which checks the entire component tree on every DOM event, Signals inform Angular *exactly* which DOM node needs to change.

```ts
import { Component, signal, computed, effect } from '@angular/core';

@Component({
  selector: 'lib-invoice-calculator',
  standalone: true,
  template: `
    <div>
      <input type="number" [value]="quantity()" (input)="updateQty($event)" />
      <p>Subtotal: {{ subtotal() | currency }}</p>
      <p>Tax (8%): {{ tax() | currency }}</p>
      <strong>Total: {{ total() | currency }}</strong>
    </div>
  `
})
export class InvoiceCalculatorComponent {
  // 1. Reactive State
  quantity = signal<number>(1);
  price = signal<number>(100);

  // 2. Computed Derived State (Automatically cached, only re-evaluates when dependencies change)
  subtotal = computed(() => this.quantity() * this.price());
  tax = computed(() => this.subtotal() * 0.08);
  total = computed(() => this.subtotal() + this.tax());

  constructor() {
    // 3. Side Effects (Use sparingly, e.g., logging or analytics)
    effect(() => {
      console.log(`Current transaction total updated to: ${this.total()}`);
    });
  }

  updateQty(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.quantity.set(value);
  }
}
```

### 🚦 Signals vs RxJS: The Decision Matrix

Signals do not replace RxJS; they work together. Use this matrix to choose:

| Use Case | Recommended Tool | Why |
| :--- | :--- | :--- |
| **Local component UI state** | `Signal` | Fine-grained reactivity, synchronous, no subscription leak risk. |
| **Derived UI state** | `Computed` | Lazily evaluated, cached, automatic dependency tracking. |
| **Asynchronous data fetches** | `RxJS Observable` | Excellent operators for cancelation (`switchMap`), debouncing, and retry logic. |
| **User input debouncing** | `RxJS Observable` | Easy time-based operations like `debounceTime(300)` and `distinctUntilChanged()`. |
| **Global event buses / streams** | `RxJS Observable` | Multi-casting and asynchronous stream composition. |

*   **RxJS/Signal Interop**: Use `toSignal()` from `@angular/core/rxjs-interop` to convert HTTP or state Observables into UI Signals, ensuring your templates stay clean of async pipes (`| async`).

---

## 📦 Standalone Architecture

We enforce **Standalone Components, Directives, and Pipes** by default. `NgModule` declarations are banned in new code.

### Guidelines for Standalone Components:
-   **Direct Imports**: Declare dependencies directly inside the component's `imports` array.
-   **Avoid Import Bloat**: Only import the specific components, pipes, or directives needed. Do not import massive, multi-export UI packages if you only use one element.
-   **Lazy Loading**: Define routes directly using `loadComponent: () => import('./...')` for lazy-loaded page features.

---

## 💉 The Functional `inject()` API

We prefer the `inject()` function for Dependency Injection over traditional constructor injection.

```ts
// 🔴 Old Constructor Injection
export class OldComponent {
  constructor(
    private billingService: BillingService,
    private route: ActivatedRoute
  ) {}
}

// 🟢 Modern Functional inject()
export class ModernComponent {
  private billingService = inject(BillingService);
  private route = inject(ActivatedRoute);
}
```

### Why `inject()` is Superior for Enterprise:
1.  **Cleaner Inheritances**: Sub-classes do not need to call `super(deps...)` when inheriting injector-bound elements.
2.  **Functional Composition**: Allows creating custom, reusable functional hooks outside of classes:
    ```ts
    // Reusable utility function to fetch route parameters
    export function getRequiredQueryParam(paramName: string) {
      const route = inject(ActivatedRoute);
      return computed(() => route.snapshot.queryParamMap.get(paramName));
    }
    ```

---

## 🎛️ Modern Control Flow Syntax

We enforce the native control flow syntax introduced in Angular 17. Structural directives like `*ngIf` and `*ngFor` are deprecated.

```html
<!-- 🟢 Native Control Flow (Clean, high performance) -->
@if (userProfile(); as profile) {
  <lib-profile-header [profile]="profile" />
} @else {
  <lib-profile-skeleton />
}

<h3>Active Subscriptions</h3>
<ul>
  @for (sub of subscriptions(); track sub.id) {
    <li>{{ sub.name }} - {{ sub.cost | currency }}</li>
  } @empty {
    <li>No active subscriptions found.</li>
  }
</ul>
```

> [!WARNING]
> -   **The `track` property is mandatory** in `@for`. Using the index as a fallback (e.g. `track $index`) should only be done if the array has no unique identifiers. Tracking by key prevents Angular from completely tearing down and recreating DOM elements during list modifications.

---

## 💤 Deferrable Views (`@defer`)

Deferrable Views are a game-changer for enterprise performance. They allow you to lazily load and render heavy parts of your application (like complex graphs, large grids, or modal blocks) only when specific conditions are met.

```html
@defer (on viewport; prefetch on idle) {
  <!-- This heavy charting component will only load its bundle and render when it scrolls into view -->
  <lib-heavy-analytics-chart [data]="chartData()" />
} @placeholder {
  <div class="skeleton-box">Loading interactive charts...</div>
} @loading (minimum 500ms) {
  <lib-spinner />
} @error {
  <div class="alert-error">Failed to load analytics dashboard. Please try again.</div>
}
```

### Mandated Trigger Strategies:
-   **`on viewport`**: Ideal for content that lives below the fold.
-   **`on interaction`**: Perfect for drop-down menus, heavy detail drawers, or collapsible content blocks.
-   **`on idle`**: Great for components that aren't critical for initial rendering but should load quickly after the main page is ready.
