# React Enterprise: Component Patterns, Composition & React Server Components (RSC)

Scalable React applications enforce structured design patterns (Container/Presentational, Render Props, Compound Components) and modern architecture paradigms (React Server Components).

---

## 🧩 1. Advanced Composition: Compound Components Pattern

Compound components share implicit state across children while allowing consumers complete freedom over UI structure.

```tsx
import React, { createContext, useContext, useState } from 'react';

// 1. Shared Internal Context
interface AccordionContextType {
  activeId: string | null;
  toggle: (id: string) => void;
}
const AccordionContext = createContext<AccordionContextType | null>(null);

// 2. Parent Container Component
export function Accordion({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const toggle = (id: string) => setActiveId((prev) => (prev === id ? null : id));

  return (
    <AccordionContext.Provider value={{ activeId, toggle }}>
      <div className="accordion-group">{children}</div>
    </AccordionContext.Provider>
  );
}

// 3. Child Sub-components
Accordion.Item = function AccordionItem({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('AccordionItem must be used within <Accordion>');
  const isOpen = context.activeId === id;

  return (
    <div className="accordion-item">
      <button onClick={() => context.toggle(id)}>{title}</button>
      {isOpen && <div className="accordion-content">{children}</div>}
    </div>
  );
};
```

---

## 🖥️ 2. React Server Components (RSC) vs Client Components

Next.js (App Router) and React 19 introduce **React Server Components (RSC)**, separating rendering contexts into Server and Client:

```
Server Environment (Node.js)                    Client Environment (Browser)
┌──────────────────────────────────────┐        ┌──────────────────────────────────────┐
│ Server Components (Default)          │        │ Client Components ('use client')     │
│  - Zero bundle impact                │───────>│  - Interactive (useState/useEffect)  │
│  - Direct DB / File access           │        │  - Browser APIs & Event Listeners    │
│  - Async data fetching (`async/await`)│        │  - Hydrated on the client            │
└──────────────────────────────────────┘        └──────────────────────────────────────┘
```

### RSC Rules & Constraints
1.  **Server Components**: Cannot use React hooks (`useState`, `useEffect`) or browser event handlers (`onClick`).
2.  **Client Components**: Declared with `'use client'` directive at top of file. Imports Server Components as `children` props to maintain server rendering boundary.

---

## 🔄 3. Cross-Framework Rosetta Stone: Component Architecture

| Pattern / Concept | React | Angular |
| :--- | :--- | :--- |
| **Child Slots / Projection** | `children` prop / Named props (`header={<Header />}`) | `<ng-content>` / `<ng-content select="[header]">` |
| **Container / Presentational** | Functional components passing props down | Smart Container Component vs Dumb UI Component |
| **Compound Components** | React Context + Sub-components | Parent Component Injection (`@Host()`, `@Optional()`) |
| **Server-Driven Components** | React Server Components (RSC) | Angular SSR (Server-Side Rendering) & `@defer` blocks |
