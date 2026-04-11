## 2026-04-11 - SearchPage Data Fetching Bottleneck
**Learning:** Context-heavy components with `useSearch()` (like `SearchPage`) re-render frequently on user input. Inline data-fetching functions passed as props to filters (like `SearchFilter.Select`) get re-created every render, causing excessive API requests to the backend.
**Action:** Always memoize inline data-fetching functions passed to components inside context-heavy pages using `useCallback` to prevent unnecessary network requests.
