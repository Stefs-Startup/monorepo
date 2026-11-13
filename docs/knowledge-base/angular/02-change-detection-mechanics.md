# Angular Enterprise: Change Detection Mechanics & Performance Tuning

Change Detection is the process by which Angular synchronizes application state with the DOM template. In large-scale enterprise applications with complex data tables, real-time telemetry streams, and hundreds of UI components, poor change detection strategy causes UI lag, frame drops, and CPU spikes.

---

## ⚙️ 1. How Change Detection Works: Zone.js vs Signals

### Zone.js Engine (Traditional Angular)
Zone.js creates a persistent execution context (`NgZone`) that monkey-patches browser asynchronous APIs (`setTimeout`, `setInterval`, `Promise.then`, `addEventListener`, `Fetch` / `XHR`).

When ANY async event fires anywhere in the browser window, Zone.js notifies Angular, triggering a **top-down re-evaluation of the ENTIRE component tree** from `AppComponent` down to every leaf node.

```
Async Event Fires (e.g. Button Click / HTTP Response)
                      │
                      ▼
               Zone.js (NgZone)
                      │
                      ▼
Top-Down Change Detection Sweep (AppComponent -> Child -> Grandchild)
 (Checks EVERY binding expression in EVERY component template in the app!)
```

### Signals Engine (Modern Zoneless Angular)
Signals replace coarse top-down tree sweeps with **fine-grained reactivity**. A Signal notifies Angular *exactly* which component and DOM node depends on its value. Only the affected component DOM updates, bypassing unnecessary parent tree checks.

---

## 🎛️ 2. `Default` vs `OnPush` Change Detection Strategy

| Feature | `ChangeDetectionStrategy.Default` | `ChangeDetectionStrategy.OnPush` *(Mandatory Enterprise)* |
| :--- | :--- | :--- |
| **Tree Checking** | Checks component on **every** async event in the app. | Skips component unless explicitly marked dirty. |
| **Performance** | O(N) where N is total components in app. | O(Log N) — checks only paths with active mutations. |
| **Immutability Requirement** | None (mutating object properties works, but is slow). | **Strict Immutability**: Requires creating new object references to trigger update. |

### When is an `OnPush` Component Checked for Changes?

An `OnPush` component will ONLY re-render under four conditions:
1.  An `@Input()` property reference changes (`prevInput !== currInput` using `Object.is` shallow comparison).
2.  An event listener declared inside the component template fires (e.g. `(click)="onSave()"`).
3.  An `Observable` bound via `AsyncPipe` emits a new value.
4.  A `Signal` read directly inside the template updates.
5.  `ChangeDetectorRef.markForCheck()` is called manually.

---

## 🛠️ 3. `ChangeDetectorRef` Control API

`ChangeDetectorRef` provides fine-grained imperative controls over change detection:

*   **`markForCheck()`**: Traverses from current component UP to the root component, marking all ancestor components as dirty. They will be included in the NEXT scheduled change detection cycle.
*   **`detectChanges()`**: Immediately executes change detection synchronously on the current component and its children. Use sparingly (e.g. for canvas rendering or zero-delay UI feedback).
*   **`detach()`**: Detaches current component tree from change detection entirely. Useful for extreme optimization (e.g., rendering 10,000 canvas nodes or heavy static data).
*   **`reattach()`**: Reattaches a previously detached component tree.

```typescript
import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-telemetry-gauge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // OnPush Enabled!
  template: `
    <div class="gauge">
      <h3>Live Sensor Status: {{ sensorValue }}</h3>
    </div>
  `
})
export class TelemetryGaugeComponent implements OnInit, OnDestroy {
  public sensorValue = 0;
  private cdr = inject(ChangeDetectorRef);
  private timerId: any;

  ngOnInit() {
    // Web Socket or High-frequency interval (e.g., 50 updates per second)
    this.timerId = setInterval(() => {
      this.sensorValue = Math.floor(Math.random() * 100);
      
      // Manual trigger: OnPush wouldn't catch setInterval without markForCheck!
      this.cdr.markForCheck();
    }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.timerId);
  }
}
```

---

## 🚨 4. Common Change Detection Performance Traps

### Trap 1: Method Calls Directly in Templates

```html
<!-- ANTI-PATTERN: DO NOT DO THIS! -->
<div>
  <p>User Full Name: {{ calculateFullName(user) }}</p> <!-- Executed 100s of times per second! -->
</div>
```

**Why it fails:**
During every single change detection cycle, Angular MUST re-execute `calculateFullName(user)` to check if the returned string changed. If the method performs array iteration, string formatting, or heavy math, frame rates crash.

#### Production Solution: Signals or Pure Pipes

```typescript
// Fix 1: Computed Signal (Cached automatically, evaluated ONLY when user() changes)
public fullName = computed(() => `${this.user().firstName} ${this.user().lastName}`);
```

```html
<!-- Template uses pre-computed signal value -->
<p>User Full Name: {{ fullName() }}</p>
```

---

### Trap 2: Running Heavy Non-UI Work Inside NgZone

By default, running a 10-second background calculations loop or heavy `window.addEventListener('scroll')` inside Angular triggers change detection on every single mouse move or scroll tick.

#### Production Solution: `NgZone.runOutsideAngular()`

```typescript
import { Component, ElementRef, inject, AfterViewInit, NgZone } from '@angular/core';

@Component({
  selector: 'app-canvas-chart',
  standalone: true,
  template: `<canvas #chartCanvas></canvas>`
})
export class CanvasChartComponent implements AfterViewInit {
  private ngZone = inject(NgZone);
  private elementRef = inject(ElementRef);

  ngAfterViewInit() {
    // Run high-frequency mousemove listeners OUTSIDE Angular's Zone!
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('mousemove', (event) => {
        this.drawCanvasAnimation(event.clientX, event.clientY);
        // NO Angular Change Detection is triggered here! CPU stays at 0%.
      });
    });
  }

  private drawCanvasAnimation(x: number, y: number) {
    // Canvas WebGL render logic...
  }
}
```
