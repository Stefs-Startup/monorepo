## 2025-02-18 - Memoize Inline Data-Fetching Functions
**Learning:** Context-heavy components in Backstage, such as those using hooks like useSearch(), re-render frequently. Inline data-fetching functions passed as props (like in SearchFilter.Select) will trigger redundant network requests on every re-render.
**Action:** Always memoize inline data-fetching functions passed as props to filters in context-heavy Backstage components using useCallback, useAsync, or useMemo.
