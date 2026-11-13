# Node.js Enterprise: Streams, Backpressure, Worker Threads & Resilience

Node.js provides low-level streaming abstractions (`stream.Readable`, `stream.Writable`, `stream.Transform`) for memory-efficient I/O, `worker_threads` for CPU-bound offloading, and circuit breakers (Opossum) for distributed system resilience.

---

## 🌊 1. Node.js Streams & Backpressure Management

When handling large datasets (e.g. multi-gigabyte logs or file exports), loading the entire file into Node memory (`fs.readFile`) causes memory spikes and Out-Of-Memory (OOM) crashes. Streams process data in chunks.

```
Source Stream (Readable) ──> Transform Stream (gzip / encrypt) ──> Destination Stream (Writable)
                                          │
                               (Backpressure Handled via pipeline())
```

### Backpressure
If the Writable stream cannot write as fast as the Readable stream reads, chunks accumulate in memory (`highWaterMark` buffer). Node automatically pauses the Readable stream until the Writable buffer drains.

### Streaming File Processing Blueprint

```typescript
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

export async function compressLargeFile(inputPath: string, outputPath: string): Promise<void> {
  // Uses streaming pipeline to handle backpressure and error cleanup automatically
  await pipeline(
    createReadStream(inputPath, { highWaterMark: 64 * 1024 }), // 64 KB chunks
    createGzip(),
    createWriteStream(outputPath)
  );
  console.log('File compressed successfully without memory bloat.');
}
```

---

## 🧵 2. Offloading CPU Tasks with Worker Threads

Node's event loop must NEVER be blocked by CPU-heavy computations (e.g. image processing, heavy encryption, PDF parsing). Use `worker_threads` to execute JavaScript in isolated parallel threads.

```typescript
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

if (isMainThread) {
  // Main Thread Spawner Utility
  export function runCpuTask(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: data });
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  }
} else {
  // Worker Thread Execution Logic
  const result = heavyComputation(workerData);
  parentPort?.postMessage(result);
}

function heavyComputation(data: any): any {
  // Intensive CPU calculation
  return data * 2;
}
```

---

## 🛡️ 3. Fault Tolerance & Circuit Breaking (Opossum)

When downstream microservices fail, hanging requests consume Node sockets and resources. A **Circuit Breaker** trips after a failure threshold, failing fast immediately without calling the degraded dependency.

```typescript
import CircuitBreaker from 'opossum';

async function fetchExternalService(): Promise<any> {
  const response = await fetch('https://unreliable-api.internal/data');
  if (!response.ok) throw new Error('Service Error');
  return response.json();
}

const breakerOptions = {
  timeout: 3000, // If request takes > 3s, fail
  errorThresholdPercentage: 50, // Trip breaker if 50% requests fail
  resetTimeout: 10000, // Wait 10s before attempting half-open recovery
};

export const externalServiceBreaker = new CircuitBreaker(fetchExternalService, breakerOptions);

externalServiceBreaker.fallback(() => ({ status: 'degraded', data: [] }));
```

---

## 🔄 4. Cross-Framework Rosetta Stone: Resilience & Performance

| Performance / Resilience Concern | Spring Boot (Java) | Node.js | Angular | React |
| :--- | :--- | :--- | :--- | :--- |
| **Circuit Breaker** | Resilience4j `@CircuitBreaker` | Opossum Circuit Breaker | Retry RxJS logic (`retry()`) | Query retry limit in TanStack Query |
| **CPU Parallelism** | Thread Pools (`Executors.newFixedThreadPool`) | `worker_threads` / Clustering | Web Workers (`new Worker()`) | Web Workers (`new Worker()`) |
| **Stream Processing** | Java Streams / Reactive Streams (Project Reactor `Flux`) | Node `stream.Readable`/`Transform` | RxJS `Observable` | Web Streams API (`ReadableStream`) |
