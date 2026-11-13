# Angular Enterprise: HTTP Interceptors & Networking Layer

HTTP Interceptors intercept, inspect, transform, or retry outgoing HTTP requests and incoming HTTP responses globally across an Angular application.

---

## 🔗 1. Functional Interceptors Pipeline Architecture (`HttpInterceptorFn`)

Angular 15+ introduced functional interceptors (`HttpInterceptorFn`), replacing class-based interceptors. Functional interceptors run in a chain sequentially before leaving the browser:

```
Angular HttpClient Request
            │
            ▼
┌────────────────────────────────────────────────────────┐
│              Functional Interceptor Chain              │
│                                                        │
│  1. AuthInterceptorFn                                  │
│     ├── Appends "Authorization: Bearer <jwt>" header   │
│     │                                                  │
│     ▼                                                  │
│  2. LoggingInterceptorFn                               │
│     ├── Measures HTTP Request Duration                 │
│     │                                                  │
│     ▼                                                  │
│  3. ErrorHandlerInterceptorFn                          │
│     └── Catches 401 / 500 status codes & retries       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
                    Browser HTTP Engine
```

---

## 🔒 2. Enterprise Authentication & JWT Refresh Interceptor

A common enterprise network requirement is automatically attaching JWT Bearer tokens to outgoing requests and handling 401 Unauthorized errors by invoking a refresh token loop.

### Production Functional Auth Interceptor Blueprint

```typescript
// interceptors/auth.interceptor.ts
import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();

  // 1. Clone request and attach Bearer token header if present
  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // 2. Execute next interceptor in chain with automatic 401 Refresh Handling
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/api/v1/auth/refresh')) {
        // Attempt transparent JWT token refresh
        return authService.refreshToken().pipe(
          switchMap((newToken: string) => {
            // Re-try original request with NEW Bearer token!
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` }
            });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            // Refresh failed: Logout user & redirect to login
            authService.logout();
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
```

---

## ⚠️ 3. Global HTTP Error Interceptor (RFC 7807 Parsing)

Parses backend RFC 7807 `ProblemDetail` response payloads and dispatches notifications:

```typescript
// interceptors/global-error.interceptor.ts
import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from '../services/notification.service';
import { catchError, throwError } from 'rxjs';

export const globalErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.error && error.error.title) {
        // RFC 7807 ProblemDetail detected!
        const title = error.error.title;
        const detail = error.error.detail || 'An error occurred';
        notificationService.showToast('error', title, detail);
      } else if (error.status === 0) {
        notificationService.showToast('error', 'Network Error', 'Unable to reach backend server');
      } else if (error.status >= 500) {
        notificationService.showToast('error', 'Server Error', 'Internal server error (500)');
      }

      return throwError(() => error);
    })
  );
};
```

---

## 💾 4. In-Memory Request Caching Interceptor

For static configuration APIs or dictionary lookup feeds, a caching interceptor eliminates redundant backend network calls:

```typescript
// interceptors/caching.interceptor.ts
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, tap } from 'rxjs';

const cacheMap = new Map<string, HttpResponse<unknown>>();

export const cachingInterceptor: HttpInterceptorFn = (req, next) => {
  // Only cache GET requests marked with header 'X-Cache-Request'
  if (req.method !== 'GET' || !req.headers.has('X-Cache-Request')) {
    return next(req);
  }

  const cachedResponse = cacheMap.get(req.urlWithParams);
  if (cachedResponse) {
    console.log(`[CACHE HIT]: Serving from memory: ${req.urlWithParams}`);
    return of(cachedResponse.clone());
  }

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        cacheMap.set(req.urlWithParams, event.clone());
      }
    })
  );
};
```

---

## ⚙️ 5. Registering Interceptors in `app.config.ts`

Functional interceptors are registered using `provideHttpClient(withInterceptors([...]))`:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import { globalErrorInterceptor } from './interceptors/global-error.interceptor';
import { cachingInterceptor } from './interceptors/caching.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        cachingInterceptor,
        globalErrorInterceptor
      ])
    )
  ]
};
```
