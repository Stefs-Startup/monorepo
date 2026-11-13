# Web Development: Web Security Standards, Authentication & Authorization

Web security is enforced by a combination of browser-enforced security policies, transport security, secure storage paradigms, and standard authentication/authorization protocols (OAuth2, OIDC, JWT).

---

## 🛡️ 1. Browser Security Model: SOP, CORS, CSRF & XSS

### 1. Same-Origin Policy (SOP)
The browser enforces the **Same-Origin Policy**: scripts running on origin A (`https://app.example.com:443`) cannot read data from origin B (`https://api.another.com:443`) unless origin B explicitly permits it.
*   **Origin Definition**: Scheme + Host + Port must match exactly.

### 2. Cross-Origin Resource Sharing (CORS)
CORS is a mechanism that allows servers to declare which origins are allowed to read responses.

```
Browser (Origin A)                             Server (Origin B)
   │                                                │
   │─── OPTIONS /api/data (Preflight Request) ────>│ (Checks Origin, Method, Headers)
   │<── 204 No Content ─────────────────────────────│
   │    Access-Control-Allow-Origin: Origin A      │
   │    Access-Control-Allow-Credentials: true     │
   │                                                │
   │─── GET /api/data (Actual Request) ────────────>│
   │<── 200 OK (Data Payload) ──────────────────────│
```

> [!WARNING]
> **CORS Misconfiguration**: Setting `Access-Control-Allow-Origin: *` while sending `Access-Control-Allow-Credentials: true` is forbidden by browsers. Never reflect the `Origin` header dynamically without strict whitelist verification.

### 3. Cross-Site Request Forgery (CSRF)
An attacker tricks an authenticated user's browser into executing an unwanted action on a trusted site where the user is currently logged in.
*   **Mitigation**:
    1.  **`SameSite` Cookie Attribute**: Set `SameSite=Strict` or `SameSite=Lax` on session/auth cookies.
    2.  **Anti-CSRF Tokens (Double Submit Cookie Pattern)**: Server issues a cryptographically random token in a cookie and requires the SPA to send it back in a custom header (e.g. `X-XSRF-TOKEN`).

### 4. Cross-Site Scripting (XSS)
Attacker injects malicious JavaScript into a web page rendered by other users.
*   **Reflected XSS**: Injected script comes from current HTTP request.
*   **Stored XSS**: Injected script stored in database and rendered to multiple users.
*   **DOM-based XSS**: Vulnerability exists in client-side code updating the DOM unsafely (e.g., `innerHTML = userInput`).
*   **Mitigation**:
    *   Context-aware output encoding.
    *   **Content Security Policy (CSP)** header: `Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted.cdn.com`.
    *   Store sensitive tokens in `HttpOnly` cookies rather than `localStorage` (where any XSS script can read them).

---

## 🔑 2. Authentication Standards: Sessions vs JWTs vs OAuth2 / OIDC

### Sessions vs JWT Comparison

| Metric | Stateful Sessions | Stateless JSON Web Tokens (JWT) |
| :--- | :--- | :--- |
| **State Location** | Server (Redis / DB session store) | Client (Signed token string) |
| **Revocation** | Instant (delete session ID from Redis) | Difficult (requires short expiry + refresh token revocation / blacklist) |
| **Scalability** | Requires distributed session cache | Horizontally scalable without centralized lookup |
| **Tamper Protection** | Session ID is an opaque random string | Cryptographically signed (HMAC SHA-256 or RSA/ECDSA signature) |

### OAuth 2.0 + PKCE (Proof Key for Code Exchange)
The gold standard for Single Page Applications (SPAs) and mobile apps:

```
Client (SPA)                 Authorization Server                 Resource Server
   │                                  │                                  │
   │── 1. Auth Request + Code Challenge─>│                                  │
   │<── 2. Redirect with Auth Code ─────│                                  │
   │                                  │                                  │
   │── 3. Token Request + Code Verifier>│                                  │
   │<── 4. Return ID Token & Access Token│                                 │
   │                                                                     │
   │── 5. API Request with Bearer Access Token ─────────────────────────>│
```

---

## 🔄 3. Cross-Framework Rosetta Stone: Security Protection

### Spring Boot (Spring Security)
```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()))
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/public/**").permitAll()
            .anyRequest().authenticated()
        )
        .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
        .build();
}
```

### Node.js / Express (Helmet + Passport)
```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

const app = express();
app.use(helmet()); // Sets Security Headers (CSP, HSTS, X-Frame-Options)
app.use(cors({ origin: 'https://app.example.com', credentials: true }));
```

### Angular (Functional Interceptor for CSRF / JWT)
```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getAccessToken();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authReq);
};
```

### React (Auth Context + Protected Route)
```tsx
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}
```
