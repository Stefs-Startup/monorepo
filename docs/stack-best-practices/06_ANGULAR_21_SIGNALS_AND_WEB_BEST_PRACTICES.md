# 6. Angular 21 Standalone Signals & Modern Web Best Practices

> **Stack Scope**: Angular `21.2.26`, TypeScript `5.9`, Standalone Components, Signals (`signal`, `computed`), Native Control Flow (`@if`, `@for`), and Vitest `4.1`.
> **Real App Reference**: `apps/pulse/web/` (Experimental Web SPA in `Stefs-Startup/monorepo`)

---

## 1. Signals-First State Management (Zero Zone.js Overhead)

In Angular 21, we manage all component and service state with **Signals (`signal()`, `computed()`)** instead of manual `BehaviorSubject` subscriptions or heavy state libraries.

### Real Example from [`pulse-state.service.ts`](../../../web/src/app/services/pulse-state.service.ts) and [`app.component.ts`](../../../web/src/app/app.component.ts)
```typescript
readonly activeTab = signal<PulseNavTab>('HORIZON');
readonly activeWindowIndex = signal<number>(0);

readonly activeWindow = computed<HorizonWindowCard | null>(() => {
  const windows = this.stateService.state().horizon.windows;
  return windows[this.activeWindowIndex()] ?? windows[0] ?? null;
});
```

---

## 2. Native Template Control Flow (`@if`, `@for`, `@switch`)

Never use legacy `*ngIf` or `*ngFor` structural directives. Always use Angular's built-in `@if` and `@for` blocks with an explicit deterministic `track` key (`track item.taskId`):

```html
@if (activeWindow(); as window) {
  @for (item of window.items; track item.taskId; let idx = $index) {
    <li class="bar-row" (click)="selectTask(item.taskId)">
      <span class="rank-pill">#{{ idx + 1 }}</span>
      <span class="bar-title">{{ item.title }}</span>
    </li>
  }
}
```

---

## 3. Template Type-Checking Lesson Learned (`TS2345`)

Angular's strict template compiler (`strictTemplates: true`) validates all `$event` bindings at build time:
- When a child component emits a strongly typed `@Output() selectCategory = new EventEmitter<SettingsCategory>()` (like [`SettingsNavigatorComponent`](../../../web/src/app/components/settings-navigator/settings-navigator.component.ts)), `$event` in the parent template is already `SettingsCategory`—do not pass a DOM `Event` into a string/enum handler.
- Always run `npm run build` (`ng build`) alongside `npm test` (`vitest`) so Angular's AOT compiler catches template type mismatches before browser UAT.

---

## 4. When to Choose Angular vs. Compose Multiplatform (`wasmJs`)

| Criterion | Angular 21 Standalone Signals | KMP + Compose Multiplatform (`wasmJs`) |
| :--- | :--- | :--- |
| **Best Use Case** | Content-heavy, SEO-indexed, or standalone web portals (`apps/backstage`, marketing/docs sites). | Apps with an existing **Kotlin + Jetpack Compose** native codebase (`apps/pulse`) where 95% code reuse and pixel/animation parity across Mobile & Web are paramount. |
| **Domain Code Sharing** | Requires porting Kotlin domain rules to TypeScript or calling a Java/Spring Boot backend. | Compiles the exact Kotlin `commonMain` domain and Compose UI directly to WebAssembly. |
