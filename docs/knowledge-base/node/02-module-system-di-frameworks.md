# Node.js Enterprise: Module Systems & Dependency Injection Frameworks

Node.js applications rely on robust module resolution mechanisms (CommonJS vs ECMAScript Modules) and Dependency Injection (DI) frameworks (NestJS, Awilix, TSyringe) for modular enterprise application design.

---

## 📦 1. CommonJS (CJS) vs ECMAScript Modules (ESM)

Node.js supports two distinct module resolution systems:

```
CommonJS (require/exports)                  ESModules (import/export)
┌──────────────────────────────────────┐    ┌──────────────────────────────────────┐
│ Synchronous loading at runtime       │    │ Asynchronous parsing & static graph  │
│ Dynamic require allowed inside code  │    │ Imports hoisted to top of file       │
│ Top-level `this` refers to `exports` │    │ Top-level `this` is `undefined`      │
│ `__dirname` & `__filename` available │    │ Must derive via `import.meta.url`    │
└──────────────────────────────────────┘    └──────────────────────────────────────┘
```

### ESM Migration Patterns in TypeScript
```typescript
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Emulating __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const configPath = join(__dirname, '../config/app.json');
```

---

## 💉 2. Dependency Injection in Enterprise Node: NestJS IoC Container

While lightweight Express applications rely on manual module imports or passing dependencies through factory functions, enterprise Node.js applications frequently adopt **NestJS** for a Spring-like Dependency Injection container.

### NestJS IoC Architecture

```
                  ┌────────────────────────┐
                  │    AppModule (Root)    │
                  └───────────┬────────────┘
                              │
             ┌────────────────┴────────────────┐
             │                                 │
  ┌──────────▼──────────┐           ┌──────────▼──────────┐
  │   UserModule        │           │   AuthModule        │
  │ ┌─────────────────┐ │           │ ┌─────────────────┐ │
  │ │ UserController  │ │           │ │ AuthController  │ │
  │ └────────┬────────┘ │           │ └────────┬────────┘ │
  │          │          │           │          │          │
  │ ┌────────▼────────┐ │           │ ┌────────▼────────┐ │
  │ │ UserService     │ │           │ │ AuthService     │ │
  │ └─────────────────┘ │           │ └─────────────────┘ │
  └─────────────────────┘           └─────────────────────┘
```

### Enterprise NestJS Provider Recipe Example

```typescript
import { Module, Injectable, Inject, Symbol } from '@nestjs/common';

// 1. Interface Token Definition
export interface PaymentGateway {
  processPayment(amount: number): Promise<boolean>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

// 2. Concrete Injectable Provider
@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  async processPayment(amount: number): Promise<boolean> {
    console.log(`Processing \$${amount} via Stripe`);
    return true;
  }
}

// 3. Consumer Service Injection
@Injectable()
export class OrderService {
  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway
  ) {}

  async checkout(orderId: string, amount: number) {
    return this.paymentGateway.processPayment(amount);
  }
}

// 4. Module Provider Binding
@Module({
  providers: [
    OrderService,
    {
      provide: PAYMENT_GATEWAY,
      useClass: StripePaymentGateway,
    },
  ],
  exports: [OrderService],
})
export class OrderModule {}
```

---

## 🔄 3. Cross-Framework Rosetta Stone: Dependency Injection

| DI Concept | Spring Boot (Java) | NestJS (Node) | Angular (Frontend) | React |
| :--- | :--- | :--- | :--- | :--- |
| **Injectable Annotation** | `@Component` / `@Service` | `@Injectable()` | `@Injectable({ providedIn: 'root' })` | N/A (React Context `createContext`) |
| **Interface Token** | Interface Class Type | `Symbol('TOKEN')` or string | `InjectionToken<T>` | Context Object |
| **Container Registration** | `@Configuration` + `@Bean` | `@Module({ providers: [...] })` | `ApplicationConfig` / `providers: []` | `<MyContext.Provider value={...}>` |
| **Injection Mechanism** | Constructor Injection | Constructor `@Inject()` | `inject(Service)` / Constructor | `useContext(MyContext)` |
