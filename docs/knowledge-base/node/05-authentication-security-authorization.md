# Node.js Enterprise: Authentication, Web Security & Authorization Mechanics

Node.js applications enforce application security through middleware defenses (Helmet, CORS, Rate Limiting), authentication strategies (Passport.js, JWT verification), and structured Role-Based Access Control (RBAC/ABAC).

---

## 🔒 1. Express Security Infrastructure (Helmet & CORS)

### Production Middleware Configuration Blueprint

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();

// 1. HTTP Header Hardening via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://trusted.cdn.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// 2. Strict CORS Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS Policy Disallowed Origin'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN'],
  })
);

// 3. Rate Limiting Protection against DDoS / Brute Force
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 429, message: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);
```

---

## 🔑 2. Passport.js & JWT Verification Strategy

### JWT Strategy Blueprint (TypeScript)

```typescript
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'super-secret-key',
  issuer: 'api.company.com',
  audience: 'app.company.com',
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
    try {
      const user = await userService.findById(jwtPayload.sub);
      if (user) {
        return done(null, user); // Attaches user object to req.user
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  })
);
```

---

## 🔄 3. Cross-Framework Rosetta Stone: Security Mechanisms

| Security Concern | Spring Boot (Java) | Node.js (Express / NestJS) | Angular (Frontend) | React |
| :--- | :--- | :--- | :--- | :--- |
| **Security Headers** | Spring Security `.headers()` | `helmet()` | Handled by backend web server | Handled by backend web server |
| **CSRF Protection** | `CookieCsrfTokenRepository` | `csurf` / Double Submit Cookie | `HttpClientModule` auto-CSRF header | Custom Axios CSRF Interceptor |
| **Rate Limiting** | Bucket4j / Spring Cloud Gateway | `express-rate-limit` / `@nestjs/throttler` | N/A | N/A |
| **RBAC Authorization** | `@PreAuthorize("hasRole('ADMIN')")` | NestJS `@Roles('ADMIN')` Guard / CASL | `CanActivateFn` Route Guard | `<ProtectedElement roles={['ADMIN']}>` |
