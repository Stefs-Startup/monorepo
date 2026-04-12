# `@cmp/config`

Shared TypeScript and tooling configurations for the CMP monorepo.

## Usage

Extend the base configurations in your package's `tsconfig.json`:

```json
{
  "extends": "@cmp/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```