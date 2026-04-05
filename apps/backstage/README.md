# [Backstage](https://backstage.io)

This is your scaffolded Backstage App, tailored for this monorepo.

## ⚠️ Important Architecture Note

This application is **intentionally excluded** from the root pnpm workspace. It is managed as its own Yarn 4 monorepo.

**For full details on WHY and HOW it is managed**, please see the [Backstage Management Guide](../../docs/backstage-management.md).

## Local Development

### Prerequisites

- **Node.js 24** (Required)
- **Corepack** (To enable Yarn 4)

### Quick Start

1. Ensure your `.env` file is configured (see the guide).
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Start the app:
   ```bash
   yarn start
   ```

## Production Deployment

### Docker

To build and run the entire stack (Backstage + PostgreSQL):

```bash
yarn build:backend
docker compose up --build
```

This uses the following configuration files:

- `Dockerfile`: Single, Node 24-based Docker build.
- `app-config.production.yaml`: Production overrides.
- `.env`: Environment variables.

## Configuration

- `app-config.yaml`: Shared base configuration.
- `app-config.production.yaml`: Database and Auth overrides.
- `app-config.local.yaml`: Ignored file for personal environment overrides.
