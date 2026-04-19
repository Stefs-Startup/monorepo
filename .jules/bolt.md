## 2024-05-24 - Memoize inline data-fetching props in Backstage SearchPage
**Learning:** Context-heavy components in Backstage like SearchPage (which uses `useSearch()`) re-render frequently. Passing unmemoized inline data-fetching functions as props to filters like `SearchFilter.Select` causes redundant network requests on every render.
**Action:** Always memoize inline data-fetching functions (e.g., using `useCallback` or `useAsync`) when passing them as props to components within a context-heavy Backstage component.
