# Web Development: HTTP Protocols, REST Architecture & API Standards

The HTTP protocol forms the backbone of web communication. Understanding protocol versions, request/response lifecycle mechanics, REST constraints, header semantics, and API design paradigms is essential for building scalable, interoperable backend and frontend applications regardless of technology stack.

---

## 🌐 1. HTTP Protocol Evolution: HTTP/1.1 vs HTTP/2 vs HTTP/3

```
HTTP/1.1 (TCP + TLS)        HTTP/2 (TCP + TLS)           HTTP/3 (QUIC / UDP)
┌───────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│  Head-of-Line Blocking│   │  Multiplexed Framing │   │  Independent Streams │
│  One Request / TCP    │   │  Single TCP Connection│   │  No HoL Blocking     │
│  Uncompressed Headers │   │  HPACK Header Compression│  │  QPACK Compression   │
└───────────────────────┘   └──────────────────────┘   └──────────────────────┘
```

### HTTP/1.1
*   **Connection Model**: Uses persistent TCP connections (`Connection: keep-alive`), but suffers from **Head-of-Line (HoL) Blocking** at the application layer: only one request can be in-flight over a TCP connection at a time.
*   **Workarounds**: Domain sharding, asset concatenation, spriting (now considered anti-patterns in modern web development).

### HTTP/2
*   **Binary Framing & Multiplexing**: Breaks requests/responses into binary frames (`DATA`, `HEADERS`, `SETTINGS`) multiplexed over a single TCP connection. Multiple requests are sent concurrently without blocking.
*   **Header Compression**: Employs **HPACK** algorithm to reduce header overhead across requests.
*   **Server Push**: Allows servers to push resources to the browser before they are requested (rarely used today due to cache invalidation complexities).
*   **Limitation**: Transport-level HoL blocking remains—if a TCP packet is dropped, all HTTP/2 streams pause until the packet is retransmitted.

### HTTP/3 (QUIC)
*   **Transport Layer**: Built on top of **QUIC (UDP-based)** instead of TCP.
*   **Zero HoL Blocking**: Loss of a single UDP packet affects ONLY the specific stream to which it belongs; other concurrent streams continue processing unhindered.
*   **Fast Connection Establishment**: Combines transport (QUIC) and security (TLS 1.3) handshakes into a single round-trip (1-RTT or 0-RTT for resumed connections).
*   **Connection Migration**: Connections are identified by a 64-bit Connection ID rather than IP/port tuples, keeping sessions active seamlessly across network changes (e.g. Wi-Fi to 5G).

---

## 🏛️ 2. REST Architecture & Idempotency Rules

Representational State Transfer (REST) is an architectural style defined by 6 core constraints: Statelessness, Client-Server, Cacheability, Uniform Interface, Layered System, and Code-on-Demand (optional).

### HTTP Method Semantics & Idempotency Matrix

| HTTP Method | Safe? (No side effects) | Idempotent? (N calls = 1 call) | Cacheable? | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **`GET`** | ✅ Yes | ✅ Yes | ✅ Yes | Retrieve resource representation |
| **`HEAD`** | ✅ Yes | ✅ Yes | ✅ Yes | Retrieve response headers only |
| **`OPTIONS`** | ✅ Yes | ✅ Yes | ❌ No | Query server capabilities / CORS preflight |
| **`POST`** | ❌ No | ❌ No | ⚠️ Conditional | Create new child resource |
| **`PUT`** | ❌ No | ✅ Yes | ❌ No | Replace target resource entirely |
| **`PATCH`** | ❌ No | ⚠️ Non-Standard (Usually No) | ❌ No | Partial modification of resource |
| **`DELETE`** | ❌ No | ✅ Yes | ❌ No | Remove resource |

> [!IMPORTANT]
> **Idempotency Rule**: Calling `PUT /users/123` with payload `{"name": "Alice"}` 100 times results in the exact same state as calling it once. Calling `POST /users` 100 times creates 100 distinct user records.

---

## 📋 3. Crucial HTTP Header Semantics

### Caching Headers (`Cache-Control`)
*   `Cache-Control: no-store` — Disallows caching anywhere. Sensitive data must never be saved to disk or shared caches.
*   `Cache-Control: no-cache` — Forces the browser to revalidate with the origin server (using `ETag` or `If-Modified-Since`) before using the cached copy.
*   `Cache-Control: public, max-age=31536000, immutable` — Used for content-hashed static assets (`main.a8b7c9.js`). Tells browser/CDN to cache for 1 year without revalidation.

### Content Negotiation Headers
*   `Accept: application/json` — Client specifies acceptable payload formats.
*   `Content-Type: application/json; charset=utf-8` — Sender specifies the MIME type of payload body.

---

## 🔄 4. Cross-Framework Rosetta Stone: API Implementation

### Spring Boot (Java)
```java
@RestController
@RequestMapping("/api/v1/invoices")
public class InvoiceController {
    @GetMapping("/{id}")
    public ResponseEntity<InvoiceDto> getInvoice(@PathVariable String id) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS))
            .body(invoiceService.findById(id));
    }
}
```

### Node.js / Express (TypeScript)
```typescript
import { Router, Request, Response } from 'express';

const router = Router();
router.get('/api/v1/invoices/:id', async (req: Request, res: Response) => {
  const invoice = await invoiceService.findById(req.params.id);
  res.set('Cache-Control', 'public, max-age=60');
  res.status(200).json(invoice);
});
```

### Frontend Data Consumption

#### Angular (`HttpClient`)
```typescript
@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private http = inject(HttpClient);
  getInvoice(id: string): Observable<InvoiceDto> {
    return this.http.get<InvoiceDto>(`/api/v1/invoices/${id}`);
  }
}
```

#### React (TanStack Query)
```typescript
export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetch(`/api/v1/invoices/${id}`).then(r => r.json()),
    staleTime: 60_000,
  });
}
```
