# Backstage Management in the Monorepo

## Architecture Decision: Isolated Yarn Workspace

The Backstage application (`apps/backstage`) is intentionally **excluded** from the main pnpm workspace (see `pnpm-workspace.yaml`). It is managed as an independent Yarn 4 monorepo nested within this project.

### Why not pnpm?
Backstage is highly optimized for the Yarn ecosystem (specifically Yarn 1/3/4). Attempting to merge it into a pnpm workspace causes several critical issues:
1.  **Module Federation Failures**: Backstage's frontend uses module federation which relies on specific dependency hoisting patterns that pnpm's strict symlinking structure breaks.
2.  **Dependency Strictness**: Many Backstage plugins have loose peer dependency requirements that require `shamefully-hoist=true` at the root, which compromises the integrity of other (non-Backstage) packages in our monorepo.
3.  **CLI Assumptions**: The `backstage-cli` contains hardcoded checks for `yarn.lock` and expects certain module resolution behaviors native to Yarn.

## Environment Requirements

### Node.js 24
Backstage in this monorepo is pinned to **Node.js 24**. While the rest of the monorepo uses Node 20, Backstage requires the newer engine for specific plugin compatibility and performance improvements.
- **Local Dev**: Ensure your local environment is on Node 24 when working in `apps/backstage`.
- **Docker**: The Dockerfiles use `node:24-bookworm-slim`.

## Configuration & Parameterization

The Backstage configuration is fully parameterized to support different environments (Local, Production). All sensitive or infrastructure-specific values are injected via environment variables.

### Key Environment Variables
Ensure these are set in your `.env` file (local) or your CI/CD secrets:

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_BASE_URL` | The URL where the frontend/backend is reachable | `http://localhost:3000` |
| `POSTGRES_HOST` | Database host (production/docker) | `postgres` |
| `GITHUB_ORG` | GitHub organization to scan for components | `Stefs-Startup` |
| `GITHUB_APP_ID` | Backstage GitHub App ID | `123456` |
| `GITHUB_APP_CLIENT_ID` | Backstage GitHub App Client ID | `Iv1.abc...` |
| `GITHUB_APP_CLIENT_SECRET`| Backstage GitHub App Client Secret | (Secure) |

### Configuration Files
- `app-config.yaml`: Shared base configuration with defaults.
- `app-config.production.yaml`: Production-specific overrides (DB, Auth).
- `app-config.local.yaml`: (Ignored) Local overrides for personal development.

## Local Development

### Installation
Do not use `pnpm install` for Backstage. Use Corepack-enabled Yarn:
```bash
cd apps/backstage
yarn install
```

### Running the App
```bash
yarn start
```

## Docker Deployment

### Multi-file Composition
We provide a `docker-compose.yml` that stands up:
1.  **Backstage Backend**: The main application.
2.  **PostgreSQL**: Persistence layer for the catalog, scaffolder, and search.

To deploy via Docker:
```bash
cd apps/backstage
docker-compose up --build
```
