# Angular Enterprise: Routing Architecture, Functional Guards & Preloading

The Angular Router maps URL paths to component trees, manages lazy loading of features, enforces access control via functional guards, and resolves critical dataset requirements before view activation.

---

## 🗺️ 1. Modern Standalone Route Tree Architecture

Angular 15+ introduced functional, standalone routing definitions, removing `RouterModule` boilerplates.

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminMatchGuard } from './guards/admin-match.guard';

export const routes: Routes = [
  // 1. Redirect Root
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // 2. Lazy Loaded Feature Module with CanMatch & CanActivate Guards
  {
    path: 'admin',
    canMatch: [adminMatchGuard], // Prevents downloading JS bundle if user lacks permissions!
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },

  // 3. Component Page with Resolver & CanDeactivate Guard
  {
    path: 'orders/:id',
    loadComponent: () => import('./orders/order-detail.component').then(m => m.OrderDetailComponent),
    canActivate: [authGuard],
    canDeactivate: [(component) => component.canLeavePage()], // Prevent losing unsaved form edits
    resolve: {
      order: orderResolver // Pre-fetches order before route component initializes!
    }
  },

  // 4. Wildcard 404 Route
  {
    path: '**',
    loadComponent: () => import('./core/not-found.component').then(m => m.NotFoundComponent)
  }
];
```

---

## 🛡️ 2. Functional Route Guards (`CanActivateFn`, `CanMatchFn`, `CanDeactivateFn`)

Legacy class-based guards (`implements CanActivate`) are deprecated. Use functional guards with `inject()` for clean, testable access control.

### 1. `CanMatchFn`: Lazy-Loading Bundle Protection

`CanMatch` is the most powerful guard for enterprise applications. Unlike `CanActivate` (which downloads the JavaScript bundle before checking permissions), `CanMatch` checks permissions **BEFORE** downloading the lazy-loaded JS chunk from the CDN.

```typescript
// guards/admin-match.guard.ts
import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminMatchGuard: CanMatchFn = (route, segments) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasRole('ROLE_ADMIN')) {
    return true;
  }

  // Redirect unauthorized users without downloading the admin JS bundle!
  return router.createUrlTree(['/forbidden']);
};
```

---

### 2. `CanActivateFn`: Authentication & Permission Guard

```typescript
// guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Preserve attempted URL for post-login redirect
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
```

---

## 🚚 3. Data Resolvers (`ResolveFn`)

Data Resolvers pre-fetch HTTP data before navigating to a route. This eliminates jarring UI loading spinners after navigation completes.

```typescript
// resolvers/order.resolver.ts
import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, EMPTY } from 'rxjs';

export interface OrderDetail {
  id: string;
  total: number;
}

export const orderResolver: ResolveFn<OrderDetail> = (route, state) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const orderId = route.paramMap.get('id');

  return http.get<OrderDetail>(`/api/v1/orders/${orderId}`).pipe(
    catchError(error => {
      router.navigate(['/orders/not-found']);
      return EMPTY;
    })
  );
};
```

#### Accessing Resolved Data in Component via Input Signal:

```typescript
import { Component, input } from '@angular/core';
import { OrderDetail } from './resolvers/order.resolver';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  template: `
    <h2>Order #{{ order().id }}</h2>
    <p>Total: {{ order().total | currency }}</p>
  `
})
export class OrderDetailComponent {
  // Angular automatically binds resolved route data directly to matching Signal Input!
  public order = input.required<OrderDetail>();
}
```

---

## ⚡ 4. Custom Selective Preloading Strategies

Lazy loading reduces initial bundle size. However, waiting for a user to click a tab before downloading its JS chunk introduces latency. Selective Preloading downloads background features speculatively after initial page load.

### Custom Selective Preloader Blueprint

```typescript
// preloading/opt-in-preloader.ts
import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OptInPreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    // Only preload routes marked with data: { preload: true }
    if (route.data && route.data['preload'] === true) {
      console.log(`[PRELOADER]: Speculatively loading chunk for path: /${route.path}`);
      return load();
    }
    return of(null);
  }
}
```

### Registration in `app.config.ts`:

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withPreloading(OptInPreloadingStrategy) // Active custom preloader!
    )
  ]
};
```
