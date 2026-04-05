# Backstage Management in the Monorepo

## Architecture Decision: Isolated Yarn Workspace

The Backstage application (`apps/backstage`) is intentionally **excluded** from the main pnpm workspace. It is managed as an independent Yarn 4 monorepo nested within this project.

### Why not pnpm?
Backstage is highly optimized for the Yarn ecosystem (specifically Yarn 1/3/4). Attempting to merge it into a pnpm workspace causes several critical issues:
1.  **Module Federation Failures**: Backstage's frontend uses module federation which relies on specific dependency hoisting patterns that pnpm's strict symlinking structure breaks.
2.  **Dependency Strictness**: Many Backstage plugins have loose peer dependency requirements that require `shamefully-hoist=true` at the root, which compromises the integrity of other (non-Backstage) packages in our monorepo.
3.  **CLI Assumptions**: The `backstage-cli` contains hardcoded checks for `yarn.lock` and expects certain module resolution behaviors native to Yarn.

## Configuration Details

### node-modules Linker
We use the `node-modules` linker in `.yarnrc.yml` instead of Yarn PnP (Plug'n'Play).
```yaml
nodeLinker: node-modules
```
This is required because the Backstage build system and several plugins are not yet fully compatible with PnP's virtual file system.

### Dependency Pinning
Certain core Backstage packages are **pinned** to specific versions in `apps/backstage/packages/backend/package.json`. 
*   **Example**: `@backstage/plugin-catalog-backend` is pinned to `3.4.0` to avoid a startup crash related to a missing experimental `alpha.core.metrics` service found in newer releases.

## Local Development

### Installation
Do not use `pnpm install` for Backstage. Use Corepack-enabled Yarn:
```bash
cd apps/backstage
yarn install
```

### Running the App
```bash
cd apps/backstage
yarn start
```

## Common Troubleshooting

### "Cannot find module 'app/package.json'"
This usually occurs if the `backend` package loses its link to the `app` package. Ensure `apps/backstage/packages/backend/package.json` contains:
```json
"dependencies": {
  "app": "link:../app"
}
```

### Module Federation Errors
If you see errors related to `__backstage-module-federation-runtime-shared-dependencies__`, it means the `node_modules` structure is corrupted or Yarn has defaulted to PnP. Ensure `nodeLinker: node-modules` is set in `.yarnrc.yml` and run `yarn install`.
