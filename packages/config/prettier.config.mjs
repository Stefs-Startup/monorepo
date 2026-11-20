/**
 * Shared Prettier formatting presets for `@cmp/*` packages and standalone apps (STE-34).
 */

export const base = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  endOfLine: "lf",
};

export const node = {
  ...base,
};

export const library = {
  ...base,
};

export const angular = {
  ...base,
  singleQuote: true,
  overrides: [
    {
      files: "*.html",
      options: {
        parser: "angular",
      },
    },
  ],
};

export const presets = {
  base,
  node,
  library,
  angular,
};

export default base;
