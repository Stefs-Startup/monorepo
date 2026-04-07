## 2024-04-07 - Memoizing inline API calls in React render loops
**Learning:** Inline async functions passed as props to components (e.g., `values` in `SearchFilter.Select`) get recreated on every render. If these functions trigger expensive operations like API calls (e.g., `catalogApi.getEntities`), it leads to redundant network requests and unnecessary component re-renders.
**Action:** Always extract and memoize such functions using `useCallback` when passing them as props that execute side-effects or network requests, ensuring stable references across renders.
