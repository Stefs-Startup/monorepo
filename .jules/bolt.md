## 2026-04-05 - Optimization of Backstage API Call Re-renders
**Learning:** In Backstage frontend components, passing anonymous async functions to the `values` prop of `SearchFilter.Select` causes unnecessary re-creations and API calls during parent component re-renders. This occurs because the child component executes the async function whenever its identity changes.
**Action:** Use `useCallback` with appropriate dependencies to memoize async functions passed down as props to filter components.
