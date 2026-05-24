# Full-Stack Integration (Combined Stack)

To build enterprise systems at scale, we must bridge the gap between our **Angular frontend** and **Java backend**. Traditional development relies on manual translation: a backend engineer updates a Java DTO, and the frontend engineer must manually rewrite the corresponding TypeScript interface. This is highly error-prone and leads to silent runtime typing failures.

We resolve this by using **OpenAPI Specification (OAS) Code Generation** to establish a single, automated source of truth.

---

## 🛠️ Contract-First API & OpenAPI Codegen

We mandate automated **TypeScript Client Generation** from our backend Spring Boot OpenAPI definitions. 

```
[ Spring Boot Controller ] ──(build time)──> [ OpenAPI JSON Spec ]
                                                    │
                                                    ▼  (openapi-generator)
[ Angular App Services ] <──(TypeScript DTOs)───────┘
```

### 1. Generating Spec from Spring Boot
We utilize the `springdoc-openapi` library to automatically generate our API specifications during the build phase:

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-api</artifactId>
    <version>2.3.0</version>
</dependency>
```

When building your Spring Boot application, the swagger specification is outputted to a JSON file (e.g. `billing-api-docs.json`).

### 2. Compiling Angular Clients via OpenAPI Generator
In the Angular workspace, we configure `@openapitools/openapi-generator-cli` to read the backend spec and output completely typed Angular HTTP Services and TypeScript models.

Add the generator tool to your monorepo development tools:
```bash
pnpm add -D @openapitools/openapi-generator-cli
```

Configure a build script in the frontend `package.json`:
```json
"scripts": {
  "codegen:api": "openapi-generator-cli generate -i ../../apps/billing-service/target/openapi.json -g typescript-angular -o src/app/core/api"
}
```

### Resulting Generated DTO:
If the Java backend declares:
```java
public record InvoiceDto(
    UUID id,
    BigDecimal total,
    Instant invoiceDate,
    String customerName
) {}
```

The generator automatically produces this TypeScript interface inside your Angular app:
```ts
// src/app/core/api/model/invoiceDto.ts
export interface InvoiceDto {
    id: string;
    total: number;
    invoiceDate: string;
    customerName: string;
}
```

And a fully typed Angular Service ready for injection:
```ts
// src/app/core/api/api/invoice.service.ts
@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  public getInvoiceById(id: string): Observable<InvoiceDto> { ... }
}
```

> [!IMPORTANT]
> If a backend engineer changes `customerId` from a `UUID` to a `Long`, or deletes a field, running `codegen:api` will immediately update the TypeScript DTOs. The Angular build will fail during compilation at typecheck phase if the frontend code is still referencing the old field, **completely preventing runtime type crashes in production**.

---

## 🔍 Dual-Layer Validation Alignment

To ensure a seamless user experience, your validation constraints should align across the full stack:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Angular Reactive Form       │ ───>  │       Spring Controller         │
│  Validators.maxLength(100)      │       │     @Size(max = 100)            │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

1.  **Frontend Validation (UX)**: Checks values instantly on user input using Angular Reactive Forms (`Validators.required`, `Validators.pattern`). It delivers high quality UX by preventing requests with invalid payloads from hitting the network.
2.  **Backend Validation (Security)**: Validates input payloads inside Java controllers using Jakarta Bean Validation (`@NotNull`, `@Size`, `@Pattern`). This acts as the secure, non-bypassable boundary wall protecting database integrity.
