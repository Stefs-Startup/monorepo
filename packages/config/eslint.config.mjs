/**
 * Shared ESLint 9 flat-config presets for `@cmp/*` packages and standalone apps (STE-34).
 * Zero external runtime dependencies so standalone stacks (e.g. apps/pulse/web) and
 * pnpm workspace packages can import presets consistently.
 */

export const base = [
  {
    name: "@cmp/config/base",
    ignores: ["**/dist/**", "**/build/**", "**/node_modules/**", "**/.angular/**", "**/.turbo/**"],
  },
  {
    name: "@cmp/config/base-rules",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
      "no-debugger": "error",
    },
  },
];

export const node = [
  ...base,
  {
    name: "@cmp/config/node",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-console": "off",
    },
  },
];

export const library = [
  ...node,
  {
    name: "@cmp/config/library",
    files: ["src/**/*.{ts,mts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["**/apps/*"],
        },
      ],
    },
  },
];

export const angular = [
  ...base,
  {
    name: "@cmp/config/angular",
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\*ng(If|For|Switch)/]",
          message: "Use Angular 21 @if/@for/@switch control flow instead of legacy *ng directives.",
        },
      ],
    },
  },
];

export const presets = {
  base,
  node,
  library,
  angular,
};

export default presets;
