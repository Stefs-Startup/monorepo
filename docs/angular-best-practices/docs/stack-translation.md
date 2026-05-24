# Full-Stack Rosetta Stone (React/Express/Knex ➡️ Angular/Java)

This guide serves as a technical "Rosetta Stone" for developers who are fluent in the **React (Frontend)** and **Node + Express + Knex + Winston (Backend)** stack—which represents the native architecture of Backstage. 

Use this guide to rapidly map your existing knowledge directly to our enterprise **Angular + Java (Spring Boot)** stack.

---

## 🎨 Frontend: React ➡️ Angular

Angular and React solve the same problem (building interactive user interfaces), but they approach it with different abstractions. Angular includes more built-in concepts that in React are usually delegated to third-party libraries.

### 1. JSX vs. Native HTML Templates & Control Flow
React compiles everything down to JavaScript (JSX) and uses JavaScript expressions for logic. Angular keeps a strict separation of concerns, writing templates in HTML with native compile-time control flow syntax:

```tsx
// ⚛️ React (JSX)
export function InvoiceList({ invoices }) {
  return (
    <div>
      {invoices.length === 0 && <p>No invoices.</p>}
      <ul>
        {invoices.map((inv) => (
          <li key={inv.id}>{inv.amount}</li>
        ))}
      </ul>
    </div>
  );
}
```

```html
<!-- 🅰️ Angular (HTML Template) -->
<div>
  <ul>
    @for (inv of invoices(); track inv.id) {
      <li>{{ inv.amount }}</li>
    } @empty {
      <p>No invoices.</p>
    }
  </ul>
</div>
```

### 2. state (useState) vs. Signals
In React, updating state triggers a shallow re-render of the component and all its children (unless optimized with `React.memo` or `useMemo`). Angular uses **Signals** for fine-grained reactivity, notifying Angular *exactly* which DOM nodes must update without running diffing algorithms across the component tree.

```ts
// ⚛️ React State
const [count, setCount] = useState(0);
const doubleCount = count * 2; // Derived value computed on every render
```

```ts
// 🅰️ Angular Signals
count = signal(0);
doubleCount = computed(() => this.count() * 2); // Cached and lazily evaluated
```

### 3. Custom Hooks vs. Injectable Services
React shares stateful logic using **Custom Hooks**. Angular delegates state and network orchestration to **Injectable Services** (singletons by default) which are injected into components using the functional `inject()` API:

```tsx
// ⚛️ React Custom Hook
export function useAuth() {
  const [user, setUser] = useState(null);
  useEffect(() => { fetchUser().then(setUser); }, []);
  return { user };
}
```

```ts
// 🅰️ Angular Injectable Service
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  user = toSignal(this.http.get<User>('/api/me'));
}

// Injected into component:
export class HeaderComponent {
  auth = inject(AuthService); // Access auth.user() inside template
}
```

### 4. Props vs. Inputs & Outputs
Data flows down through properties and flows back up through event callbacks:

```tsx
// ⚛️ React Props
<InvoiceCard amount={100} onSelect={(id) => handleSelect(id)} />
```

```ts
// 🅰️ Angular Inputs & Outputs
// Component:
amount = input<number>(0);
select = output<string>();

// HTML Template usage:
<lib-invoice-card [amount]="100" (select)="handleSelect($event)" />
```

---

## 🪵 Backend: Node/Express/Knex ➡️ Java/Spring Boot

Backstage backends are typically written in **Node.js with Express** for routing and **Knex** for direct database queries. Spring Boot provides an opinionated framework that replaces these manual integrations with declaratively autowired modules.

### 1. Express Router vs. Spring `@RestController`
In Express, you configure routes and middleware by chaining calls onto a router instance. In Spring Boot, you use annotations directly on Java classes:

```ts
// 🟢 Node.js + Express
import express from 'express';
const router = express.Router();

router.get('/invoices/:id', async (req, res, next) => {
  try {
    const invoice = await getInvoice(req.params.id);
    return res.status(200).json(invoice);
  } catch (err) {
    next(err); // Forward to global error middleware
  }
});
```

```java
// 🍃 Java + Spring Boot
@RestController
@RequestMapping("/invoices")
public class InvoiceController {
    private final GetInvoiceUseCase getInvoiceUseCase;

    public InvoiceController(GetInvoiceUseCase getInvoiceUseCase) {
        this.getInvoiceUseCase = getInvoiceUseCase;
    }

    @GetMapping("/{id}")
    public ResponseEntity<InvoiceDto> getInvoiceById(@PathVariable UUID id) {
        InvoiceDto dto = getInvoiceUseCase.execute(id);
        return ResponseEntity.ok(dto); // 200 OK
    }
}
```

### 2. Knex Query Builder vs. Spring Data JPA
Backstage developers write database queries using Knex to assemble SQL. In Spring Boot, we use **Spring Data JPA** to interact with repositories, which abstract raw SQL queries completely into object methods:

```ts
// 🟢 Node.js + Knex
const invoice = await database('invoices')
  .where({ id: invoiceId })
  .select('id', 'amount', 'customer_id')
  .first();
```

```java
// 🍃 Java + Spring Data JPA
// 1. Declare Repository Interface (Spring generates implementation!)
public interface InvoiceRepository extends JpaRepository<InvoiceEntity, UUID> {}

// 2. Fetch Entity inside Outbound Persistence Adapter
Optional<InvoiceEntity> entity = invoiceRepository.findById(invoiceId);
```

### 3. Dependency Injection: Options Passing vs. Autowired Constructor
Backstage backends use manual Dependency Injection by passing dependencies inside a config object:

```ts
// 🟢 Node.js / Backstage Backend Plugin
export interface PluginOptions {
  logger: Logger;
  database: DatabaseManager;
  config: Config;
}

export function createRouter(options: PluginOptions): express.Router {
  const { logger, database, config } = options;
  // Manual use of services...
}
```

In Spring Boot, the framework scans classes annotated with `@Component`, `@Service`, or `@Repository` and automatically resolves dependencies via the **Class Constructor**:

```java
// 🍃 Java + Spring Boot DI
@Service
public class InvoiceService implements GetInvoiceUseCase {
    private final InvoiceRepositoryPort repository;
    private final Logger logger = LoggerFactory.getLogger(InvoiceService.class);

    // Spring Boot automatically injects this repository at boot time!
    public InvoiceService(InvoiceRepositoryPort repository) {
        this.repository = repository;
    }
}
```

---

## 🏛️ Backstage-Specific Concept Alignments

If you are a Backstage Developer, you can map Backstage core concepts directly to Angular:

### 1. Backstage `ApiRef` ➡️ Angular `InjectionToken`
In Backstage, plugins communicate with central APIs (like Catalog, Discovery, or Config) using an **`ApiRef`**:

```ts
// 🟢 Backstage ApiRef Injection
import { catalogApiRef, useApi } from '@backstage/core-plugin-api';

export function CatalogComponent() {
  const catalogApi = useApi(catalogApiRef); // Resolves singleton API
}
```

This maps 100% to Angular's native **Dependency Injection (DI) system** using `InjectionToken` variables:

```ts
// 🅰️ Angular InjectionToken Injection
export const CATALOG_API_TOKEN = new InjectionToken<CatalogApi>('CatalogApi');

export class CatalogComponent {
  private catalogApi = inject(CATALOG_API_TOKEN); // Resolves DI singleton
}
```

### 2. Yarn Berry Workspaces ➡️ pnpm Workspaces
Backstage uses Yarn Berry workspaces (`yarn.lock` and `.yarnrc.yml`). We use **pnpm workspaces** in our monorepo root (`pnpm-lock.yaml` and `pnpm-workspace.yaml`). The execution is conceptually identical:

*   Backstage: `yarn workspace @internal/plugin-catalog start`
*   Our Monorepo: `pnpm --filter @cmp/web dev`
