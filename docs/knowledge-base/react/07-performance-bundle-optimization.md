# React Enterprise: Performance Tuning, Memoization & Bundle Optimization

Optimizing enterprise React applications requires profiling rendering bottlenecks, strategic memoization (`React.memo`, `useCallback`, `useMemo`), and code-splitting with `React.lazy` and `Suspense`.

---

## ⚡ 1. Rendering Optimization: Memoization Mechanics

By default, when a parent component re-renders, **all child components re-render recursively**, regardless of whether their props changed.

```
Parent Re-renders
      │
┌─────┴─────┐
│           │
▼           ▼
Child 1   Child 2 (Re-renders even if props did NOT change!)
```

### Memoization Primitive Rules
1.  **`React.memo`**: Wraps a component to perform a shallow comparison of incoming props. If props haven't changed, React skips component function execution.
2.  **`useCallback`**: Memoizes function references passed as callbacks to child components wrapped in `React.memo`.
3.  **`useMemo`**: Caches expensive calculation results between re-renders.

> [!CAUTION]
> **Memoization Anti-Pattern**: Passing an un-memoized inline object or inline function (`onClick={() => doStuff()}`) as a prop to a `React.memo` component breaks shallow equality checks on *every* render, rendering `React.memo` useless!

### Correct Memoization Blueprint

```tsx
import React, { useState, useCallback, useMemo } from 'react';

interface ItemProps {
  item: { id: string; name: string };
  onSelect: (id: string) => void;
}

// 1. Memoized Child Component
const ListItem = React.memo(function ListItem({ item, onSelect }: ItemProps) {
  console.log(`Rendering ListItem ${item.id}`);
  return <button onClick={() => onSelect(item.id)}>{item.name}</button>;
});

// 2. Parent Container
export function ItemListContainer({ items }: { items: { id: string; name: string }[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Memoized Callback Reference
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []); // Stable identity across re-renders

  // Memoized Expensive Filter Operation
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  return (
    <div>
      <h3>Selected ID: {selectedId}</h3>
      {sortedItems.map((item) => (
        <ListItem key={item.id} item={item} onSelect={handleSelect} />
      ))}
    </div>
  );
}
```

---

## 📦 2. Code-Splitting with `React.lazy` & `Suspense`

Code-splitting breaks large JavaScript bundles into dynamic chunks loaded on-demand when routes or components enter view.

```tsx
import React, { lazy, Suspense } from 'react';

// Dynamic import creates lazy loading chunk
const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard'));

export function AdminArea() {
  return (
    <div>
      <h2>Admin Panel</h2>
      <Suspense fallback={<div className="spinner">Loading Analytics...</div>}>
        <AnalyticsDashboard />
      </Suspense>
    </div>
  );
}
```

---

## 🔄 3. Cross-Framework Rosetta Stone: Performance Primitives

| Optimization Goal | React | Angular |
| :--- | :--- | :--- |
| **Skip Unnecessary Subtree Renders**| `React.memo(Component)` | `ChangeDetectionStrategy.OnPush` |
| **Cache Function References** | `useCallback(fn, [deps])` | N/A (Class methods maintain stable identity) |
| **Cache Computation** | `useMemo(() => val, [deps])` | `computed(() => val)` |
| **Lazy Loading Components** | `React.lazy()` + `<Suspense>` | Deferrable Views (`@defer`) / Route `loadComponent` |
