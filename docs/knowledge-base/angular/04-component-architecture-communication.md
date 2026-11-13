# Angular Enterprise: Component Architecture & Content Projection

Enterprise frontend architecture relies on clean component separation, modern Signal-based inputs/outputs, flexible content projection, and dynamic runtime component instantiation.

---

## 🏛️ 1. Smart (Container) vs Dumb (Presentational) Component Architecture

```
                                  ┌───────────────────────────┐
                                  │   OrderPage (Container)   │  (Smart: Manages RxJS, Services, State)
                                  └─────────────┬─────────────┘
                                                │
                      ┌─────────────────────────┴─────────────────────────┐
                      ▼                                                   ▼
         ┌──────────────────────────┐                        ┌──────────────────────────┐
         │ OrderHeaderComponent     │                        │ OrderTableComponent      │  (Dumb: Pure UI,
         │ (Presentational)         │                        │ (Presentational)         │   Inputs/Outputs,
         └──────────────────────────┘                        └──────────────────────────┘   OnPush)
```

| Feature | Container Component (Smart) | Presentational Component (Dumb) |
| :--- | :--- | :--- |
| **Primary Role** | Data orchestration, HTTP fetches, routing, state management. | Pure UI rendering and user interaction handling. |
| **Dependencies** | Injects services, NgRx stores, Router, HTTP clients. | Zero service injections. Uses ONLY Inputs and Outputs. |
| **Change Detection** | Default or OnPush. | `ChangeDetectionStrategy.OnPush` strictly enforced. |
| **Reusability** | Feature-specific, tied to application business logic. | Highly reusable across multiple application contexts. |

---

## ⚡ 2. Modern Signal-Based Inputs, Outputs & Models

Angular 17.2+ introduced type-safe Signal primitives for component APIs, replacing legacy `@Input()` and `@Output()` decorators.

### Signal Inputs (`input()`) & Outputs (`output()`)

```typescript
import { Component, input, output, model, ChangeDetectionStrategy, computed } from '@angular/core';

export interface InvoiceItem {
  id: string;
  description: string;
  price: number;
}

@Component({
  selector: 'lib-invoice-item-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="item-row">
      <span>{{ item().description }}</span>
      <span>{{ item().price | currency }}</span>
      <input type="number" [value]="quantity()" (input)="onQtyChange($event)" />
      <strong>Subtotal: {{ subtotal() | currency }}</strong>
      <button (click)="remove.emit(item().id)">Delete</button>
    </div>
  `
})
export class InvoiceItemRowComponent {
  // 1. Required Signal Input (Type-safe & Read-only Signal)
  public item = input.required<InvoiceItem>();

  // 2. Optional Input with Default Value
  public isReadOnly = input<boolean>(false);

  // 3. Two-Way Model Signal (Writable from both parent and child!)
  public quantity = model<number>(1);

  // 4. Signal Output (Replaces EventEmitter)
  public remove = output<string>();

  // 5. Computed derived state from inputs
  public subtotal = computed(() => this.item().price * this.quantity());

  public onQtyChange(event: Event) {
    const val = +(event.target as HTMLInputElement).value;
    this.quantity.set(val); // Automatically updates parent model binding!
  }
}
```

---

## 📦 3. Content Projection Patterns

Content Projection allows passing custom HTML markup or components into a child component layout.

### Multi-Slot Content Projection (`<ng-content select="...">`)

```typescript
@Component({
  selector: 'lib-card',
  standalone: true,
  template: `
    <div class="card-container">
      <header class="card-header">
        <ng-content select="[card-title]"></ng-content>
      </header>
      <main class="card-body">
        <ng-content></ng-content> <!-- Default catch-all slot -->
      </main>
      <footer class="card-footer">
        <ng-content select="[card-actions]"></ng-content>
      </footer>
    </div>
  `
})
export class CardComponent {}
```

#### Consumer Usage:

```html
<lib-card>
  <h2 card-title>Monthly Revenue Report</h2>
  
  <p>Total Revenue for August: $120,000</p>
  
  <div card-actions>
    <button>Export PDF</button>
  </div>
</lib-card>
```

---

## 🔍 4. Signal Queries (`viewChild` / `contentChild`)

Signal queries replace `@ViewChild` and `@ContentChild` with signals that update automatically when DOM nodes change.

```typescript
import { Component, ElementRef, viewChild, contentChild, AfterViewInit } from '@angular/core';

@Component({
  selector: 'lib-custom-input',
  standalone: true,
  template: `<input #inputElement type="text" />`
})
export class CustomInputComponent implements AfterViewInit {
  // Signal View Child (Type: Signal<ElementRef<HTMLInputElement> | undefined>)
  public inputEl = viewChild<ElementRef<HTMLInputElement>>('inputElement');

  ngAfterViewInit() {
    // Access native DOM element safely
    this.inputEl()?.nativeElement.focus();
  }
}
```

---

## 🧩 5. Dynamic Component Instantiation (`ngComponentOutlet`)

For dynamic dashboards, modal systems, or plugin frameworks, instantiate components dynamically at runtime using `ngComponentOutlet`.

```typescript
import { Component, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';

@Component({
  selector: 'app-widget-host',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  template: `
    <div class="widget-wrapper">
      <ng-container *ngComponentOutlet="activeWidgetComponent; inputs: widgetInputs"></ng-container>
    </div>
  `
})
export class WidgetHostComponent {
  // Dynamically resolve component type at runtime
  public activeWidgetComponent: Type<any> = RevenueChartWidgetComponent;

  // Pass inputs to dynamically created component!
  public widgetInputs = {
    timeframe: 'MONTHLY',
    showLegend: true
  };
}
```
