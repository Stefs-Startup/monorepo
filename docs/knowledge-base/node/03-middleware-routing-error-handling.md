# Node.js Enterprise: Middleware Pipelines, Routing & Error Handling

Node.js web frameworks execute HTTP request/response handling through request middleware chains (Express / Fastify) or structured pipeline primitives (NestJS Guards, Interceptors, Pipes, and Exception Filters).

---

## 🛠️ 1. Express Middleware Pipeline & Execution Mechanics

In Express, requests pass sequentially through a stack of middleware functions. Each middleware function receives `(req, res, next)`.

```
Incoming HTTP Request
         │
┌────────▼────────────────┐
│ Logging Middleware      │ (Logs timestamp, calls next())
└────────┬────────────────┘
         │
┌────────▼────────────────┐
│ Authentication          │ (Attaches req.user, calls next())
└────────┬────────────────┘
         │
┌────────▼────────────────┐
│ Route Controller        │ (Sends res.json(), does NOT call next())
└────────┬────────────────┘
         │
 ┌───────┴────────┐ (If an error is thrown or next(err) is called)
 │
┌▼────────────────────────┐
│ Global Error Middleware │ (Format: (err, req, res, next) => res.status(500)...)
└─────────────────────────┘
```

> [!WARNING]
> **Unhandled Promise Rejections in Express 4**: Express 4 does NOT catch uncaught rejected promises in async route handlers automatically. Unhandled promise rejections will crash or hang the process! Always wrap async handlers in a try/catch or helper utility (`express-async-handler`).

### Async Middleware Error Handling Blueprint

```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';

// Async wrapper to safely forward rejected promises to error middleware
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Express Global Error Handling Middleware (Must have 4 parameters)
export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error(`[ERROR] ${req.method} ${req.url}:`, err);

  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
  });
};
```

---

## 🏛️ 2. NestJS Request Lifecycle: Guards, Interceptors, Pipes & Filters

NestJS wraps HTTP execution in a structured execution pipeline:

```
Request ──> Middleware ──> Guards ──> Interceptors (Pre) ──> Pipes ──> Controller ──> Interceptors (Post) ──> Exception Filters ──> Response
```

1.  **Guards**: Determines if the request is authorized (`CanActivate`).
2.  **Interceptors (Pre)**: Binds extra logic before route execution (e.g. logging, starting performance timers).
3.  **Pipes**: Validates and transforms input payloads (`ValidationPipe` with `class-validator`).
4.  **Controller / Handler**: Executes business logic.
5.  **Interceptors (Post)**: Transforms output response or handles caching (`RxJS` stream mapping).
6.  **Exception Filters**: Catches unhandled exceptions and formats standardized JSON RFC 7807 responses (`@Catch()`).

---

## 🔄 3. Cross-Framework Rosetta Stone: Middleware & Error Pipelines

| Pipeline Primitive | Spring Boot (Java) | Node.js (Express / NestJS) | Angular (Frontend) | React |
| :--- | :--- | :--- | :--- | :--- |
| **Request Interception** | `HandlerInterceptor` / Servlet `Filter` | Express Middleware / NestJS Interceptor | `HttpInterceptorFn` | Axios Request Interceptor |
| **Authorization Check** | Spring Security `SecurityFilterChain` | NestJS `CanActivate` Guard | `CanActivateFn` Route Guard | React Router `loader` auth check |
| **Input Validation** | `@Valid` / JSR-380 annotations | NestJS `ValidationPipe` / Zod | Reactive Forms Validators | React Hook Form + Zod |
| **Global Error Handling** | `@ControllerAdvice` + `@ExceptionHandler` | Express 4-param Error Middleware / NestJS Exception Filter | `ErrorHandler` class / HTTP Error Interceptor | React Error Boundary (`componentDidCatch`) |
