# Telemetry & Observability

In a large enterprise, relying on users to report frontend bugs or slow load times is unacceptable. Observability must be baked into our applications from day one.

We establish three core layers of observability in our Angular applications: **Distributed Tracing (OpenTelemetry)**, **Real User Monitoring (RUM)**, and **Standardized Global Error Handlers**.

---

## 🌐 OpenTelemetry in Angular

We use OpenTelemetry (OTel) to trace frontend requests and correlate them with backend microservices. This allows developers to trace an action (e.g., clicking "Pay Invoice") from the browser through API Gateways, backend services, and database queries.

```ts
// packages/telemetry/src/lib/telemetry.init.ts
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';

export function initializeTelemetry(serviceName: string, collectorUrl: string) {
  const provider = new WebTracerProvider({
    resource: new Resource({
      'service.name': serviceName,
    }),
  });

  // Export spans to a central OpenTelemetry collector
  const exporter = new OTLPTraceExporter({ url: collectorUrl });
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  provider.register({
    contextManager: new ZoneContextManager(), // Integrates with Angular's Zone.js / custom context
  });

  // Automatically trace all network fetches
  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [new RegExp('.*api\\.company\\.com.*')],
      }),
    ],
  });
}
```

---

## 📊 Real User Monitoring (RUM) & Performance Metrics

We actively capture user-centric performance metrics, specifically **Core Web Vitals**, using the web-vitals API to track performance regressions in real-time.

```ts
import { onCLS, onINP, onLCP } from 'web-vitals';

export function startPerformanceMonitoring(sendToSink: (metric: any) => void) {
  // Largest Contentful Paint (LCP) - Measures loading performance
  onLCP((metric) => sendToSink({ name: 'LCP', value: metric.value, rating: metric.rating }));

  // Cumulative Layout Shift (CLS) - Measures visual stability
  onCLS((metric) => sendToSink({ name: 'CLS', value: metric.value, rating: metric.rating }));

  // Interaction to Next Paint (INP) - Measures user UI responsiveness
  onINP((metric) => sendToSink({ name: 'INP', value: metric.value, rating: metric.rating }));
}
```

---

## 🚨 Custom Global Error Handling

Angular provides a default `ErrorHandler` that simply prints uncaught runtime errors to the developer console. For production applications, we override this class to catch, enrich, and forward errors to our observability platforms (e.g., Sentry, Datadog, or our central Telemetry Sink).

```ts
// packages/telemetry/src/lib/global-error-handler.ts
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Location } from '@angular/common';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private location = inject(Location);
  private telemetryService = inject(TelemetryService); // Custom telemetry sink client

  handleError(error: any): void {
    const errorDetails = {
      message: error.message || error.toString(),
      stack: error.stack || 'No stack trace available',
      timestamp: new Date().toISOString(),
      url: this.location.path(),
      browser: navigator.userAgent,
      screenResolution: `${window.innerWidth}x${window.innerHeight}`,
      environment: 'production' // Set dynamically via environment config
    };

    // 1. Log to server telemetry pipeline
    this.telemetryService.captureException(errorDetails);

    // 2. Fallback console logging for developer debugging (with semantic tracing context)
    console.error('[Global Error Handler] Caught uncaught exception:', errorDetails);
  }
}
```

### Registering the Custom Error Handler:
Configure your global error handler inside your application's bootstrap configurations:

```ts
// apps/customer-portal/src/app/app.config.ts
import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from '@cmp/telemetry';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
```

---

## 🪵 Structured Logging Standard

To prevent chaotic and uncontrolled log outputs, we enforce strict logging standards:

> [!IMPORTANT]
> -   **No `console.log` in Production**: Code review gates must fail if arbitrary `console.log` statements are left in feature code. Use a proper logging utility.
> -   **Structured JSON Logs**: Our telemetry service outputs formatted logs containing:
>     -   `level` (e.g., `info`, `warn`, `error`, `debug`)
>     -   `domain` (e.g., `billing`, `user-profile`)
>     -   `message` (clear text explanation)
>     -   `context` (key-value structured metadata object, never stringified stack traces)
