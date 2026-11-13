# React Enterprise: Virtual DOM, Fiber Architecture & Reconciliation Mechanics

React uses a declarative component model powered by an in-memory representation of the UI called the **Virtual DOM (VDOM)** and a re-implementation of the core reconciliation engine known as **React Fiber**.

---

## 🌲 1. The React Fiber Architecture

Prior to React 16 (Stack Reconciler), rendering was recursive and synchronous—once started, it could not be interrupted, causing main thread jank. **React Fiber** introduced an asynchronous, incremental reconciler that breaks rendering into units of work.

```
       Render Phase (Asynchronous / Interruptible)              Commit Phase (Synchronous / Uninterruptible)
┌────────────────────────────────────────────────────────┐     ┌───────────────────────────────────────────┐
│ WorkLoop (Fiber Tree Traversal)                        │     │ Mutation Phase                            │
│  - Executes component render functions                 │────>│  - Applies DOM updates to browser DOM     │
│  - Calculates diffs (flags: Placement, Update, Delete) │     │  - Executes useLayoutEffect cleanup/mount │
│  - Can be paused/yielded for high-priority user input  │     │ Passive Phase                             │
└────────────────────────────────────────────────────────┘     │  - Executes useEffect callbacks           │
                                                               └───────────────────────────────────────────┘
```

### Double Buffering in Fiber
Fiber maintains two trees simultaneously:
1.  **`current` tree**: Represents the UI rendered on screen.
2.  **`workInProgress` tree**: Constructed in memory during the Render phase. Once rendering completes, React swaps the root pointer in a single atomic operation (`workInProgress` becomes `current`).

---

## 🔍 2. Reconciliation Algorithm & Key Semantics

When state changes, React diffs the newly returned JSX element tree against the existing tree using heuristic algorithms operating in **$O(n)$** time complexity based on two assumptions:

1.  **Different Element Types**: If element tags differ (`<div>` replaced with `<span>`), React unmounts the entire old subtree, destroying state, and mounts a new tree.
2.  **Keys in Dynamic Lists**: React uses the `key` prop to match children in the original tree with children in the subsequent tree across re-renders.

> [!WARNING]
> **Anti-Pattern: Index as Key**: Using array indices (`key={index}`) in dynamic or sortable lists causes state misalignment, broken inputs, and degraded performance during re-ordering. Always use unique stable identifiers (`key={item.id}`).

---

## ⚡ 3. Automatic Batching & Concurrent Features (`useTransition`)

React 18 introduced **Automatic Batching** (grouping state updates inside promises, timeouts, and event handlers into a single re-render) and Concurrent Rendering primitives.

### Prioritizing User Input with `useTransition`

```tsx
import React, { useState, useTransition } from 'react';

export function ProductSearch() {
  const [filter, setFilter] = useState('');
  const [list, setList] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Urgent Update: Immediate input box feedback
    setFilter(value);

    // Transition Update: Non-urgent expensive list filtering deferred
    startTransition(() => {
      const filteredList = heavyListSearch(value);
      setList(filteredList);
    });
  };

  return (
    <div>
      <input type="text" value={filter} onChange={handleSearch} placeholder="Search products..." />
      {isPending && <p>Filtering dataset...</p>}
      <ProductGrid items={list} />
    </div>
  );
}
```

---

## 🔄 4. Cross-Framework Rosetta Stone: Rendering Engines

| Concept | React | Angular |
| :--- | :--- | :--- |
| **Rendering Strategy** | Virtual DOM (Fiber reconciliation diffing) | Incremental DOM (Direct DOM node updates via Signals / Ivy instructions) |
| **Change Detection Trigger** | Component state mutation (`setState`, `useReducer`) re-runs component function | Signals fine-grained reactivity / Zone.js monkey-patching event triggers |
| **Optimization Boundary** | `React.memo(Component)` skips component function re-execution | `ChangeDetectionStrategy.OnPush` skips subtree dirty-checking |
| **Interruptible Render** | Concurrent Mode (`useTransition`, `useDeferredValue`) | Deferrable Views (`@defer (on viewport)`) |
