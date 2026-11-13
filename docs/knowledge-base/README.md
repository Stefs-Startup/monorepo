# Enterprise Architecture & Full-Stack Knowledge Base

Welcome to the **Enterprise Architecture Knowledge Base**. This repository serves as the definitive reference manual for building, scaling, and maintaining mission-critical enterprise applications across modern full-stack web technologies: **Web Platform Fundamentals**, **Spring Boot** (Java Backend), **Node.js** (Async JavaScript/TypeScript Backend), **Angular** (TypeScript Enterprise SPA), and **React** (Component-Based UI Engine).

---

## 🎯 Philosophy & Core Principles

Modern enterprise software development requires deep mastery of fundamental mechanics—not just superficial API usage or chasing framework hype. This knowledge base focuses on:

1. **Foundational Mechanics Over Framework Hype**: Understanding IoC container internals, Libuv Event Loop phases, React Fiber Virtual DOM reconciliation, Angular Signals reactivity, and database persistence context states.
2. **Production-Grade Blueprints**: Providing complete, executable code blueprints rather than simplified "hello world" snippets.
3. **Failure-Mode Prevention**: Explicitly detailing anti-patterns, proxy pitfalls, memory leaks, stale closures, and concurrency hazards before they reach production.
4. **Cross-Framework Translation (Rosetta Stone)**: Enabling developers fluent in one stack (e.g. Node or React) to rapidly understand, compare, and contrast concepts and implementations in another (e.g. Spring Boot or Angular).

---

## 🗺️ Knowledge Base Structure

```
docs/knowledge-base/
├── web-development/                       # Shared Web Platform & Protocol Fundamentals
│   ├── 01-http-protocols-rest-apis.md     # HTTP/1.1, HTTP/2, HTTP/3, REST, Headers & Idempotency
│   ├── 02-web-security-auth-standards.md  # SOP, CORS, CSRF, XSS, CSP, Cookies, OAuth2 / OIDC & JWT
│   └── 03-browser-rendering-dom-performance.md # Critical Rendering Path, DOM, Web Vitals & Storage
│
├── spring/                                # Spring Enterprise Knowledge Base (Java)
│   ├── 01-dependency-injection-ioc.md     # IoC Container, Bean Lifecycle & Injection Patterns
│   ├── 02-transaction-management.md       # @Transactional Propagation, Isolation & Proxy Traps
│   ├── 03-data-jpa-hibernate.md           # Persistence Context, N+1 Query & Caching Mechanics
│   ├── 04-spring-security-architecture.md # SecurityFilterChain, Auth Flows & SPA Security
│   ├── 05-spring-mvc-exception-handling.md# DispatcherServlet, Exception Handling & Validation
│   └── 06-spring-boot-autoconfig-resilience.md # Auto-Config, Custom Starters & Resilience4j
│
├── node/                                  # Node.js Enterprise Knowledge Base (TypeScript/JS)
│   ├── 01-event-loop-async-architecture.md# Event Loop, Libuv Threadpool, Microtasks & Timers
│   ├── 02-module-system-di-frameworks.md  # ESM vs CommonJS, NestJS IoC & Provider Recipes
│   ├── 03-middleware-routing-error-handling.md # Express Middleware, NestJS Guards/Pipes/Filters
│   ├── 04-database-orm-persistence.md     # Knex.js Query Builder, Prisma ORM & Transactions
│   ├── 05-authentication-security-authorization.md # Helmet, CORS, Passport.js, Rate Limiting & RBAC
│   └── 06-performance-streams-resilience.md # Streams, Backpressure, Worker Threads & Circuit Breakers
│
├── angular/                               # Angular Enterprise Knowledge Base (TypeScript)
│   ├── 01-dependency-injection-tree.md    # Hierarchical Injectors & Resolution Modifiers
│   ├── 02-change-detection-mechanics.md   # Zone.js vs Signals, OnPush & Dirty Checking
│   ├── 03-rxjs-reactive-patterns.md       # Higher-Order Operators, Cancellation & Error Flows
│   ├── 04-component-architecture-communication.md # Smart/Dumb Components, Signals & Content Projection
│   ├── 05-routing-guards-resolvers.md     # Route Trees, Functional Guards & Preloading
│   ├── 06-reactive-forms-cva.md           # Reactive Forms, Custom ControlValueAccessor & Validation
│   ├── 07-http-interceptors-networking.md # Functional Interceptors, Token Refresh & Error Handling
│   └── 08-performance-bundle-optimization.md # @defer Blocks, Lazy Loading & Bundle Tuning
│
└── react/                                 # React Enterprise Knowledge Base (TypeScript/JS)
    ├── 01-virtual-dom-reconciliation.md   # Fiber Architecture, VDOM Diffing & Concurrent Mode
    ├── 02-hooks-state-management.md       # Hooks Internals, Stale Closures & Zustand / Context
    ├── 03-component-architecture-patterns.md # Compound Components, Composition & Server Components (RSC)
    ├── 04-routing-navigation.md           # React Router v6 Data APIs, Loaders & Protected Routes
    ├── 05-forms-validation.md             # Controlled/Uncontrolled Mechanics, React Hook Form & Zod
    ├── 06-data-fetching-networking.md     # TanStack Query (React Query) Caching & Optimistic Updates
    └── 07-performance-bundle-optimization.md # React.memo, useCallback, useMemo & Code Splitting
```

---

## 🌐 Web Development Fundamentals Modules Overview

| Module | Core Concepts Covered |
| :--- | :--- |
| **[01. HTTP Protocols & REST APIs](web-development/01-http-protocols-rest-apis.md)** | HTTP/1.1 vs HTTP/2 multiplexing vs HTTP/3 QUIC, Idempotency matrix, `Cache-Control` header semantics, REST constraints. |
| **[02. Web Security & Auth Standards](web-development/02-web-security-auth-standards.md)** | Same-Origin Policy (SOP), CORS preflight requests, CSRF mitigation, XSS & Content Security Policy (CSP), OAuth2/OIDC + PKCE. |
| **[03. Browser Rendering & DOM](web-development/03-browser-rendering-dom-performance.md)** | Critical Rendering Path (DOM, CSSOM, Render Tree, Layout, Paint, Composite), Core Web Vitals (LCP, INP, CLS), Client Storage comparison. |

---

## 🍃 Spring Enterprise Modules Overview (Backend - Java)

| Module | Core Concepts Covered |
| :--- | :--- |
| **[01. Dependency Injection & IoC](spring/01-dependency-injection-ioc.md)** | `BeanFactory` vs `ApplicationContext`, 11-Step Bean Lifecycle, Bean Scopes, Constructor Injection & Circular Dependencies. |
| **[02. Transaction Management](spring/02-transaction-management.md)** | `@Transactional` AOP Proxy mechanics, 7 Propagation Types, Isolation Levels, Rollback rules (`rollbackFor`), Proxy Traps. |
| **[03. Spring Data JPA & Hibernate](spring/03-data-jpa-hibernate.md)** | Persistence Context (Managed/Detached/Transient), N+1 Query resolution (Fetch Joins, `@EntityGraph`), L1/L2 Caching, Optimistic vs Pessimistic Locking. |
| **[04. Spring Security Architecture](spring/04-spring-security-architecture.md)** | `SecurityFilterChain` execution pipeline, `AuthenticationManager`, OAuth2 / JWT Resource Server, Cookie-based CSRF protection & CORS. |
| **[05. Spring MVC & Exception Handling](spring/05-spring-mvc-exception-handling.md)** | `DispatcherServlet` pipeline, `@ControllerAdvice` global exception handlers, RFC 7807 (`ProblemDetail`) standard error responses, JSR-380 validation. |
| **[06. Spring Boot Auto-Config & Resilience](spring/06-spring-boot-autoconfig-resilience.md)** | `@EnableAutoConfiguration` mechanics, Writing Custom Starters, Resilience4j Circuit Breakers & `@Async` thread pools. |

---

## 🟢 Node.js Enterprise Modules Overview (Backend - TypeScript/JS)

| Module | Core Concepts Covered |
| :--- | :--- |
| **[01. Event Loop & Async Architecture](node/01-event-loop-async-architecture.md)** | Event Loop phases, Libuv thread pool (`UV_THREADPOOL_SIZE`), `process.nextTick` vs Promise microtasks, Non-blocking I/O. |
| **[02. Module Systems & DI Frameworks](node/02-module-system-di-frameworks.md)** | CommonJS vs ESM load mechanics, NestJS IoC/DI container (`@Injectable()`, custom providers, dynamic modules). |
| **[03. Middleware & Error Handling](node/03-middleware-routing-error-handling.md)** | Express middleware pipeline, async error wrappers, NestJS Guards, Pipes, Interceptors, and Exception Filters. |
| **[04. Database & ORM Persistence](node/04-database-orm-persistence.md)** | Knex.js query builder, Prisma ORM, connection pooling, transaction isolation, explicit transactions vs Unit of Work. |
| **[05. Security & Authentication](node/05-authentication-security-authorization.md)** | Passport.js JWT verification, Helmet header hardening, CORS configuration, rate limiting (`express-rate-limit`), CASL RBAC. |
| **[06. Performance, Streams & Resilience](node/06-performance-streams-resilience.md)** | `stream.Readable`/`Writable`/`Transform`, backpressure handling, `worker_threads` CPU offloading, Opossum circuit breakers. |

---

## 🅰️ Angular Enterprise Modules Overview (Frontend - TypeScript)

| Module | Core Concepts Covered |
| :--- | :--- |
| **[01. Dependency Injection Tree](angular/01-dependency-injection-tree.md)** | `ModuleInjector` vs `ElementInjector` hierarchies, `providedIn` scopes, Provider Recipes (`useClass`, `useFactory`), Resolution modifiers (`@Optional`, `@SkipSelf`). |
| **[02. Change Detection Mechanics](angular/02-change-detection-mechanics.md)** | Zone.js event monkey-patching vs Signals fine-grained reactivity, `Default` vs `OnPush` change detection, `ChangeDetectorRef` dirty checking controls. |
| **[03. RxJS Reactive Patterns](angular/03-rxjs-reactive-patterns.md)** | Cold vs Hot Observables, Memory leak prevention (`takeUntilDestroyed`), Higher-Order Mapping (`switchMap`, `mergeMap`), Resilient Error Flows. |
| **[04. Component Architecture](angular/04-component-architecture-communication.md)** | Smart vs Dumb components, Signal inputs (`input()`), Signal outputs (`output()`), Single/Multi-slot `<ng-content>` projection. |
| **[05. Routing & Guards](angular/05-routing-guards-resolvers.md)** | Child route trees, Functional Route Guards (`CanActivateFn`), Data Resolvers (`ResolveFn`), Custom Preloading Strategies. |
| **[06. Reactive Forms & CVA](angular/06-reactive-forms-cva.md)** | Enterprise `FormGroup`/`FormArray`, Custom controls via `ControlValueAccessor` (CVA), Async & Cross-field Validation. |
| **[07. HTTP Interceptors](angular/07-http-interceptors-networking.md)** | Functional `HttpInterceptorFn`, JWT Auth token injection, Refresh token queueing with retry loops, Global Error interceptors. |
| **[08. Performance & Optimization](angular/08-performance-bundle-optimization.md)** | Deferrable Views (`@defer`), Loop tracking (`track`), Code splitting, Lazy loading, Web Worker offloading. |

---

## ⚛️ React Enterprise Modules Overview (Frontend - TypeScript/JS)

| Module | Core Concepts Covered |
| :--- | :--- |
| **[01. Virtual DOM & Reconciliation](react/01-virtual-dom-reconciliation.md)** | Fiber architecture, VDOM diffing algorithm, render vs commit phases, keys in dynamic lists, concurrent mode & `useTransition`. |
| **[02. Hooks & State Management](react/02-hooks-state-management.md)** | Linked-list hook storage, stale closure pitfalls, functional updates, React Context vs Zustand atomic stores. |
| **[03. Component Architecture & RSC](react/03-component-architecture-patterns.md)** | Compound components pattern, render props, React Server Components (RSC) vs Client Components (`'use client'`). |
| **[04. Routing & Data Loaders](react/04-routing-navigation.md)** | React Router v6 Data APIs, loader functions, route error boundaries, nested layouts (`<Outlet />`), protected route guards. |
| **[05. Forms & Validation](react/05-forms-validation.md)** | Controlled vs Uncontrolled form mechanics, React Hook Form performance, type-safe Zod schema validation. |
| **[06. Data Fetching & Server State](react/06-data-fetching-networking.md)** | TanStack Query (React Query) server state caching, invalidation, stale time vs gc time, optimistic mutations & rollback. |
| **[07. Performance & Optimization](react/07-performance-bundle-optimization.md)** | `React.memo` shallow comparison, `useCallback`/`useMemo` reference stability, dynamic imports, `React.lazy` & `<Suspense>`. |

---

## 🏛️ Rosetta Stone Cross-Framework Matrix

This matrix provides an instant technical translation across all 4 major frameworks and core Web Standards:

```
┌───────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
│ Concept / Concern     │ Spring Boot (Java)   │ Node.js (TS / JS)    │ Angular (Frontend)   │ React (Frontend)     │
├───────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Core Concurrency      │ Multi-Threaded JVM   │ Single-Threaded V8   │ Single-Threaded V8   │ Single-Threaded V8   │
│                       │ (Tomcat Thread Pool /│ Event Loop + Libuv   │ Browser Event Loop   │ Browser Event Loop   │
│                       │ Virtual Threads)     │ Threadpool           │                      │                      │
├───────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Dependency Injection  │ ApplicationContext / │ NestJS IoC Container │ Element & Module     │ React Context        │
│                       │ @Component / @Bean   │ @Injectable()        │ Injector Trees       │ Provider / Zustand   │
├───────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Rendering / UI Engine │ Server Templating    │ Server Templating    │ Incremental DOM      │ Virtual DOM (Fiber   │
│                       │ (Thymeleaf / JSP)    │ (EJS / Handlebars)   │ Signals & Ivy        │ Reconciliation)      │
├───────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ State Reactive Model  │ Project Reactor      │ Node EventEmitters / │ Signals & RxJS       │ useState / useReducer│
│                       │ (Mono / Flux)        │ RxJS                 │ Observables          │ / Zustand Stores     │
├───────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Persistence / ORM     │ Spring Data JPA /    │ Knex.js SQL Builder /│ N/A (Frontend)       │ N/A (Frontend)       │
│                       │ Hibernate ORM        │ Prisma / TypeORM     │                      │                      │
├───────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Request Interception  │ Servlet Filter /     │ Express Middleware / │ Functional           │ Axios Interceptors / │
│                       │ HandlerInterceptor   │ NestJS Interceptor   │ HttpInterceptorFn    │ TanStack Query       │
├───────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Global Error Handling │ @ControllerAdvice    │ Express 4-param Error│ ErrorHandler /       │ React Error Boundary │
│                       │ + @ExceptionHandler  │ Middleware / Filter  │ Error Interceptor    │ (componentDidCatch)  │
├───────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ Route Authorization   │ Spring Security      │ NestJS Guard         │ Functional           │ Loader Redirect /    │
│                       │ SecurityFilterChain  │ (CanActivate)        │ CanActivateFn Guard  │ Protected Route      │
└───────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘
```
