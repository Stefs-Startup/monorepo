# Angular Enterprise: Performance & Bundle Optimization

Building high-performance enterprise applications requires optimizing initial bundle sizes, deferring non-critical template loading, leveraging fast DOM reconciliation algorithms, and offloading heavy computational tasks off the browser UI thread.

---

## ⚡ 1. Deferrable Views (`@defer` Blocks)

Angular 17 introduced `@defer` blocks, allowing components, directives, and CSS to be lazy-loaded on demand directly from the template without configuring routing routes.

### Anatomy of an `@defer` Block

```html
@defer (on viewport) {
  <!-- Lazy loaded component chunk downloaded ONLY when scrolled into viewport! -->
  <app-heavy-chart-widget [data]="chartData()"></app-heavy-chart-widget;>
} @placeholder (minimum 500ms) {
  <!-- Shown initial static content before download starts -->
  <div class="skeleton-chart-placeholder">Loading Chart...</div>
} @loading (after 100ms, minimum 1s) {
  <!-- Shown while JS bundle chunk is actively downloading from CDN -->
  <app-spinner></app-spinner>
} @error {
  <!-- Shown if CDN network error occurs -->
  <p>Failed to load chart widget.</p>
}
```

---

### Enterprise `@defer` Triggers

| Trigger | Syntax | Description |
| :--- | :--- | :--- |
| **`on idle`** *(Default)* | `@defer (on idle)` | Downloads chunk when browser main thread enters idle state (`requestIdleCallback`). |
| **`on viewport`** | `@defer (on viewport)` | Downloads chunk when placeholder enters browser viewport (IntersectionObserver). |
| **`on interaction`** | `@defer (on interaction)` | Downloads chunk when user clicks or focuses placeholder element. |
| **`on hover`** | `@defer (on hover)` | Downloads chunk speculatively when user hovers mouse over placeholder. |
| **`when condition`** | `@defer (when isExpanded())` | Downloads chunk when boolean Signal or expression resolves to `true`. |

---

## 🔁 2. Control Flow & DOM Reconciliation (`@for` track)

Angular 17 replaced `*ngFor` with built-in `@for` loops. Specifying a `track` expression is **mandatory** for high-performance DOM reconciliation.

### ❌ Legacy `*ngFor` without `trackBy` (Performance Hazard)
When an array mutates in `*ngFor`, Angular destroys and re-creates EVERY SINGLE DOM NODE in the list, causing massive DOM layout recalculations, input state loss, and scroll jumps.

### ✅ Built-in `@for` with `track` Expression

```html
<ul class="user-list">
  @for (user of users(); track user.id) {
    <li>
      <span>{{ user.name }}</span>
      <span>{{ user.email }}</span>
    </li>
  } @empty {
    <p class="empty-state">No users match criteria.</p>
  }
</ul>
```

**Why `track user.id` is Fast:**
Angular tracks items by unique primary key `user.id`. When array order changes or items are prepended, Angular moves existing DOM elements in place without destroying or re-instantiating them.

---

## 🧵 3. Web Workers for Offloading Heavy Computations

JavaScript runs on a single main UI thread. Executing heavy CSV parsing, cryptography, or matrix math on the main thread freezes UI animations and blocks user clicks.

Web Workers run background scripts on an isolated background OS thread.

### Step 1: Create Web Worker Script (`data-parser.worker.ts`)

```typescript
/// <reference lib="webworker" />

addEventListener('message', ({ data }) => {
  console.log('[WORKER]: Received raw CSV dataset for parsing...');
  
  // Heavy computation executed on background thread!
  const parsedData = parseHeavyCsv(data.csvContent);

  // Post parsed result back to main UI thread
  postMessage(parsedData);
});

function parseHeavyCsv(rawContent: string) {
  // Heavy parsing algorithm...
  return [{ id: '1', amount: 5000 }];
}
```

### Step 2: Consume Worker in Component

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-data-importer',
  standalone: true,
  template: `<button (click)="startParsing()">Parse 50MB File</button>`
})
export class DataImporterComponent implements OnInit, OnDestroy {
  private worker!: Worker;

  ngOnInit() {
    if (typeof Worker !== 'undefined') {
      // Instantiate Web Worker thread
      this.worker = new Worker(new URL('./data-parser.worker', import.meta.url), { type: 'module' });

      // Receive message from worker thread
      this.worker.onmessage = ({ data }) => {
        console.log('[MAIN THREAD]: Received parsed data from worker:', data);
      };
    }
  }

  startParsing() {
    const rawCsv = "id,amount\n1,5000";
    this.worker.postMessage({ csvContent: rawCsv }); // Send to background thread!
  }

  ngOnDestroy() {
    this.worker.terminate(); // Clean up worker thread on destroy
  }
}
```

---

## 📦 4. Tree-Shaking & Vendor Bundle Optimization

### 1. Avoid Barrel File Re-export Chains
Avoid importing from barrel files `index.ts` that aggregate hundreds of components. Importing one utility from a barrel file frequently pulls in the entire library bundle.

### 2. Configure `angular.json` Bundle Budget Warnings
Set strict production build budgets to catch bundle bloat during CI build steps:

```json
"configurations": {
  "production": {
    "budgets": [
      {
        "type": "initial",
        "maximumWarning": "500kB",
        "maximumError": "1MB"
      },
      {
        "type": "anyComponentStyle",
        "maximumWarning": "4kB",
        "maximumError": "8kB"
      }
    ]
  }
}
```
