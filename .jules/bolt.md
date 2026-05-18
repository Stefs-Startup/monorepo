## 2026-04-18 - Memoize Inline Functions in Context-Heavy React Components
**Learning:** In the Backstage app codebase, context-heavy components like `SearchPage` that use hooks like `useSearch()` re-render frequently. Inline data-fetching functions passed as props (e.g., to `SearchFilter.Select`) cause redundant network requests on every render if not memoized.
**Action:** Use `useCallback` or similar memoization hooks for data-fetching functions passed as props in components that re-render frequently to prevent redundant network requests.
