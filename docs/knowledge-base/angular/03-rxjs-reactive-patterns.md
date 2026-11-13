# Angular Enterprise: RxJS Reactive Patterns & Memory Management

RxJS is the reactive stream engine powering Angular's HTTP client, Router, Event System, and Reactive Forms. In enterprise applications, mismanaging subscriptions causes memory leaks, race conditions, duplicate HTTP requests, and out-of-order state updates.

---

## 🌊 1. Cold vs Hot Observables & Multicasting

### Cold Observables
*   **Lazy Execution**: Does not produce values until a consumer subscribes (`.subscribe()`).
*   **Unicast**: Each subscriber gets a completely independent execution stream.
*   *Example*: Angular `HttpClient.get()` is cold. Subscribing 3 times executes 3 distinct HTTP network calls!

### Hot Observables
*   **Eager Execution**: Produces values regardless of active subscribers.
*   **Multicast**: Values are shared across all active subscribers simultaneously.
*   *Example*: `Subject`, `BehaviorSubject`, DOM event listeners.

### Multicasting with `shareReplay()`

To prevent duplicate HTTP calls when multiple components or pipes need the same HTTP resource, use `shareReplay({ bufferSize: 1, refCount: true })`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class UserStateService {
  private http = inject(HttpClient);

  // Multicasted HTTP Stream: Executes 1 network request regardless of subscriber count!
  public readonly currentUser$: Observable<UserProfile> = this.http.get<UserProfile>('/api/v1/user/me').pipe(
    shareReplay({ bufferSize: 1, refCount: true }) // Keeps last value, cleans up when subscribers = 0
  );
}
```

---

## 🛑 2. Subscription Management & Memory Leak Prevention

Unsubscribed RxJS Observables (especially infinite streams like `interval`, WebSocket feeds, or Router events) keep component references alive in memory after DOM destruction.

### Method 1: `takeUntilDestroyed()` (Modern Recommended Pattern)

Use `takeUntilDestroyed()` from `@angular/core/rxjs-interop`. It automatically cleans up the subscription when the current injection context (Component/Service) is destroyed.

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

@Component({
  selector: 'app-ticker',
  standalone: true,
  template: `<p>Tick Counter</p>`
})
export class TickerComponent implements OnInit {

  constructor() {
    // Called in Injection Context: Automatic cleanup!
    interval(1000).pipe(
      takeUntilDestroyed()
    ).subscribe(count => {
      console.log(`Tick: ${count}`);
    });
  }

  ngOnInit() {}
}
```

---

### Method 2: Declarative Template Binding via `AsyncPipe` or `toSignal()`

Avoid `.subscribe()` completely by handling streams declaratively in templates:

```html
<!-- AsyncPipe manages subscribe & unsubscribe automatically -->
<div *ngIf="user$ | async as user">
  <h3>Welcome, {{ user.name }}</h3>
</div>
```

```typescript
// Or convert Observable to Signal cleanly:
public userSignal = toSignal(this.userService.currentUser$, { initialValue: null });
```

---

## 🔀 3. The 4 Higher-Order Mapping Operators Demystified

Higher-order operators transform an outer value into an inner Observable stream. Choosing the wrong operator creates race conditions and state corruption.

```
Outer Emission ──► [ Operator ] ──► Inner Observable Execution
```

| Operator | Inner Stream Behavior | Primary Enterprise Use Case |
| :--- | :--- | :--- |
| **`switchMap`** | **Cancels** previous inner stream when a new outer value arrives. | Typeahead Search inputs, Navigation switches, Filter tab changes. |
| **`mergeMap`** | Runs all inner streams **concurrently** in parallel. | Parallel file uploads, Independent batch fetching. |
| **`concatMap`** | Queues inner streams, running them **sequentially** in exact order. | Queued state updates, Ordered database saves, Form step progressions. |
| **`exhaustMap`** | **Ignores** new outer values while current inner stream is active. | Submit buttons, Login buttons, Payment processing clicks. |

---

### Enterprise Code Blueprint: Typeahead Search with `switchMap`

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <input [formControl]="searchControl" placeholder="Search users by name..." />
    <ul>
      <li *ngFor="let result of searchResults$ | async">{{ result.name }}</li>
    </ul>
  `
})
export class UserSearchComponent implements OnInit {
  private http = inject(HttpClient);
  public searchControl = new FormControl('');

  public searchResults$ = this.searchControl.valueChanges.pipe(
    debounceTime(300),                     // 1. Wait for user typing to pause 300ms
    distinctUntilChanged(),                 // 2. Ignore duplicate query terms
    switchMap(query => {                    // 3. CANCEL pending HTTP request if user types new query!
      if (!query || query.trim() === '') {
        return of([]);
      }
      return this.http.get<any[]>(`/api/v1/users/search?q=${query}`).pipe(
        catchError(err => {
          console.error('Search failed', err);
          return of([]); // Fallback to empty array without breaking main stream!
        })
      );
    })
  );

  ngOnInit() {}
}
```

---

## 🛡️ 4. Enterprise Resilient Error Handling

Uncaught exceptions in RxJS stream pipelines **permanently terminate (kill)** the Observable stream. Subsequent user actions will silently fail.

### Rule: Inner Stream Error Handling

Always catch errors inside `switchMap` / `mergeMap` inner streams so the parent stream stays alive!

```typescript
public liveUpdates$ = this.refreshTrigger$.pipe(
  switchMap(() => 
    this.http.get('/api/v1/data').pipe(
      // ✅ Correct: Error caught INSIDE inner stream. Main refreshTrigger$ stays active!
      catchError(error => {
        this.notificationService.showError('Failed to refresh data');
        return of(null); // Return fallback stream
      })
    )
  )
);
```

### Automatic Retry with Exponential Backoff Strategy

```typescript
import { retry, timer } from 'rxjs';

public resilientFetch$ = this.http.get('/api/v1/unstable-endpoint').pipe(
  retry({
    count: 3,
    delay: (error, retryCount) => {
      console.warn(`Retry attempt #${retryCount} after error`);
      return timer(retryCount * 1000); // Backoff delay: 1s, 2s, 3s
    }
  })
);
```
