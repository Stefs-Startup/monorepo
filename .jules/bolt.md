## 2024-04-08 - Unnecessary API calls in Backstage Search Context
**Learning:** Backstage context-heavy components like `SearchPage` (using `useSearch()`) re-render frequently upon any user typing or state updates. Passing inline functions as props to components like `SearchFilter.Select` will re-trigger API fetches (like `catalogApi.getEntities`) on every keystroke if left unmemoized.
**Action:** Always wrap data-fetching functions passed as props in `useCallback` when within search context or other highly active contexts to prevent excessive network requests.
