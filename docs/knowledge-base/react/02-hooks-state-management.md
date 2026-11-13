# React Enterprise: Hooks Internals, State Management & Closure Mechanics

React Hooks (`useState`, `useEffect`, `useReducer`, `useContext`, `useCallback`, `useMemo`, `useRef`) allow functional components to attach local state and side-effects. Mastering hook execution order, closure pitfalls, and state architecture is vital for complex React applications.

---

## 🪝 1. Rules of Hooks & Internal Storage

React relies on the **order of hook calls** to associate hook state with component Fiber nodes. Internally, each Fiber node maintains a linked list of hook records:

```
Fiber Node
 └─ memoizedState ──> [ Hook 1 (useState) ] ──> [ Hook 2 (useEffect) ] ──> [ Hook 3 (useMemo) ]
```

### The Rules of Hooks
1.  **Call Hooks at the Top Level Only**: Never call hooks inside loops, conditions, or nested functions.
2.  **Call Hooks from React Functions Only**: Call hooks only from React functional components or custom hooks.

---

## ⚠️ 2. Stale Closures & Dependency Array Mechanics

A **stale closure** occurs when an asynchronous callback or effect captures state/props variables from an earlier render pass, referencing outdated values indefinitely.

```tsx
// ❌ BAD: Stale Closure in useEffect
export function TimerCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // Always reads count = 0 captured during initial mount!
      console.log('Current count:', count);
      setCount(count + 1); // Updates 0 + 1 repeatedly!
    }, 1000);
    return () => clearInterval(timer);
  }, []); // Empty dependency array captures initial render scope

  return <div>Count: {count}</div>;
}

// ✅ GOOD: Functional State Update
export function CorrectTimerCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prev) => prev + 1); // Receives latest state from React
    }, 1000);
    return () => clearInterval(timer);
  }, []); // Safe dependency array

  return <div>Count: {count}</div>;
}
```

---

## 🏛️ 3. State Architecture: Context API vs Zustand / Redux Toolkit

### State Management Matrix

| Metric | React Context API | Zustand (Atomic / Store) | Redux Toolkit (RTK) |
| :--- | :--- | :--- | :--- |
| **Primary Purpose** | Low-frequency global UI state (Theme, Auth) | Modern global app state | Enterprise complex state with middleware |
| **Re-render Scope** | All consumers re-render when context value mutates | Fine-grained re-renders via selector sub-subscriptions | Fine-grained re-renders via selector sub-subscriptions |
| **Boilerplate** | Medium (Provider wrapper required) | Minimal (No provider wrapper) | Structured (Slices, Reducers, Actions) |

### Zustand Enterprise Store Blueprint

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UserState {
  user: { id: string; name: string; email: string } | null;
  isAuthenticated: boolean;
  setUser: (user: { id: string; name: string; email: string } | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        setUser: (user) => set({ user, isAuthenticated: !!user }, false, 'setUser'),
        logout: () => set({ user: null, isAuthenticated: false }, false, 'logout'),
      }),
      { name: 'user-auth-storage' }
    )
  )
);
```

---

## 🔄 4. Cross-Framework Rosetta Stone: State Primitives

| State Concept | React | Angular |
| :--- | :--- | :--- |
| **Component Local State** | `useState(initial)` / `useReducer(reducer, init)` | `signal(initial)` / `writableSignal` |
| **Derived State** | `useMemo(() => compute(val), [val])` | `computed(() => compute(signal()))` |
| **Side Effects** | `useEffect(() => { ... }, [deps])` | `effect(() => { ... })` |
| **DOM Reference** | `useRef(null)` | `@ViewChild('ref')` / `elementRef` |
| **Global State Sharing** | React Context / Zustand Store | Injectable Service (`@Injectable({ providedIn: 'root' })`) |
