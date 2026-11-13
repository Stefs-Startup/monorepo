# React Enterprise: Routing, Navigation & Data Loaders

Client-side routing in React applications is managed via libraries such as React Router (v6+), TanStack Router, or framework file-system routers (Next.js App Router).

---

## 🛣️ 1. React Router v6 Architecture: Data APIs & Loaders

React Router v6 Data APIs decouple data fetching from component render cycles. Route loaders fetch data *in parallel* with component bundle loading before rendering begins.

```
URL Change (`/dashboard/invoices`)
               │
   ┌───────────┴───────────┐
   │                       │
┌──▼──────────────────┐ ┌──▼──────────────────┐
│ Fetch Route Loader  │ │ Fetch Route JS      │ (Parallel Execution)
│ (invoiceLoader)     │ │ Bundle (Lazy Chunk) │
└──┬──────────────────┘ └──┬──────────────────┘
   │                       │
   └───────────┬───────────┘
               │
     ┌─────────▼─────────┐
     │ Render Layout UI  │ (No waterfall spin-up delays!)
     └───────────────────┘
```

### Enterprise React Router Blueprint

```tsx
import { createBrowserRouter, RouterProvider, Outlet, redirect, useLoaderData } from 'react-router-dom';

// 1. Data Loader Function
export async function invoiceLoader({ params }: any) {
  const token = localStorage.getItem('access_token');
  if (!token) throw redirect('/login'); // Protected Route Redirect

  const res = await fetch(`/api/invoices/${params.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) throw new Response('Invoice Not Found', { status: 404 });
  return res.json();
}

// 2. Protected Layout Component
export function DashboardLayout() {
  return (
    <div className="dashboard-grid">
      <SidebarNav />
      <main>
        <Outlet /> {/* Renders child route components */}
      </main>
    </div>
  );
}

// 3. Router Configuration Tree
export const router = createBrowserRouter([
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      {
        path: 'invoices/:id',
        element: <InvoiceDetail />,
        loader: invoiceLoader,
        errorElement: <RouteErrorBoundary />,
      },
    ],
  },
]);
```

---

## 🔄 2. Cross-Framework Rosetta Stone: Routing Systems

| Routing Primitive | React (React Router / Next.js) | Angular (Angular Router) |
| :--- | :--- | :--- |
| **Route Definition** | `createBrowserRouter([ { path, element } ])` | `Routes = [ { path, component } ]` |
| **Child Route Slot** | `<Outlet />` | `<router-outlet />` |
| **Pre-render Data Fetching**| Route `loader` function | Data Resolver (`ResolveFn`) |
| **Route Authorization** | Loader redirects / `<Navigate />` wrapper | Route Guards (`CanActivateFn`, `CanMatchFn`) |
| **Code Splitting** | `React.lazy(() => import('./Page'))` + `Suspense` | `loadComponent: () => import('./page').then(...)` |
