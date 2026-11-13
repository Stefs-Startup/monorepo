# React Enterprise: Data Fetching, TanStack Query & Network Interceptors

Client-side network management in React applications relies on asynchronous data-fetching managers (**TanStack Query / React Query**) to handle server state, caching, deduplication, invalidation, and optimistic updates.

---

## 🌐 1. Server State vs Client State Mechanics

Client applications manage two distinct categories of state:

```
Client State (Local UI Controls)               Server State (Remote Source of Truth)
┌──────────────────────────────────────┐        ┌──────────────────────────────────────┐
│ Synchronous local state (useState)   │        │ Asynchronous remote persistence      │
│ Retained in browser memory           │        │ Requires caching, stale invalidation │
│ Examples: Modals, active tabs, theme │        │ Examples: User profiles, orders      │
└──────────────────────────────────────┘        └──────────────────────────────────────┘
```

---

## 🚀 2. Production Data Fetching Blueprint: TanStack Query (React Query)

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Invoice {
  id: string;
  amount: number;
  status: 'PENDING' | 'PAID';
}

// 1. Fetching API Query
export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async (): Promise<Invoice[]> => {
      const res = await fetch('/api/invoices');
      if (!res.ok) throw new Error('Network error fetching invoices');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
    gcTime: 10 * 60 * 1000, // Keep in memory cache for 10 minutes
  });
}

// 2. Optimistic Mutation Blueprint
export function usePayInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, { method: 'POST' });
      return res.json();
    },
    // Optimistic Update: Update UI instantly before server responds
    onMutate: async (invoiceId) => {
      await queryClient.cancelQueries({ queryKey: ['invoices'] });
      const previousInvoices = queryClient.getQueryData<Invoice[]>(['invoices']);

      queryClient.setQueryData<Invoice[]>(['invoices'], (old) =>
        old?.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'PAID' } : inv))
      );

      return { previousInvoices };
    },
    // Rollback on error
    onError: (err, invoiceId, context) => {
      queryClient.setQueryData(['invoices'], context?.previousInvoices);
    },
    // Always revalidate after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
```

---

## 🔄 3. Cross-Framework Rosetta Stone: Data Fetching & Interceptors

| Data Fetching Feature | React (TanStack Query + Axios) | Angular (HttpClient + RxJS) |
| :--- | :--- | :--- |
| **Http Client Primitive** | `fetch` / Axios instance | Angular `HttpClient` |
| **Request / Response Interceptors**| Axios Interceptors (`axios.interceptors.request.use`) | Functional Interceptors (`HttpInterceptorFn`) |
| **Server State Caching** | TanStack Query (`queryKey`, `staleTime`) | RxJS `shareReplay(1)` / NgRx Data Store |
| **Async Cancellation** | `AbortController` signal | RxJS `switchMap` cancellation |
