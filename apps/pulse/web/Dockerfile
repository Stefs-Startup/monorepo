# =============================================================================
# RFC-0002 Surface 2: apps/pulse/web (Angular 21 SPA + Nginx Edge Proxy)
# Pattern: Multi-stage Node AOT build -> Unprivileged Nginx static/proxy runtime
# =============================================================================

# --- Stage 1: Build Angular 21 production bundle (AOT + content hashing) ----
FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy lockfile first for deterministic dependency layer caching.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Inline monorepo-root tsconfig preset when building from standalone apps/pulse/web context.
RUN node -e ' \
  const fs = require("fs"); \
  const cur = JSON.parse(fs.readFileSync("tsconfig.json", "utf8")); \
  if (cur.extends && !fs.existsSync(cur.extends)) { \
    delete cur.extends; \
    cur.compileOnSave = false; \
    cur.compilerOptions = Object.assign({ \
      target: "ES2022", \
      module: "ES2022", \
      moduleResolution: "bundler", \
      strict: true, \
      esModuleInterop: true, \
      skipLibCheck: true, \
      forceConsistentCasingInFileNames: true, \
      isolatedModules: true, \
      noImplicitOverride: true, \
      noPropertyAccessFromIndexSignature: true, \
      noImplicitReturns: true, \
      noFallthroughCasesInSwitch: true, \
      experimentalDecorators: true, \
      importHelpers: true \
    }, cur.compilerOptions || {}); \
    cur.angularCompilerOptions = Object.assign({ \
      enableI18nLegacyMessageIdFormat: false, \
      strictInjectionParameters: true, \
      strictInputAccessModifiers: true, \
      strictTemplates: true \
    }, cur.angularCompilerOptions || {}); \
    fs.writeFileSync("tsconfig.json", JSON.stringify(cur, null, 2)); \
  }' \
    && npm run build \
    && test -f dist/pulse-web/browser/index.html

# --- Stage 2: Unprivileged Nginx runtime (UID 101, zero Node.js in prod) ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Angular 21 (@angular/build:application) emits static assets into dist/pulse-web/browser/.
COPY --from=builder /workspace/dist/pulse-web/browser/ /usr/share/nginx/html/

# Nginx template + sourced startup hook for 12-factor PORT, API_UPSTREAM_URL, & revision.
# Temporarily switch to root (0) to ensure +x works on legacy Docker builders without --chmod,
# then immediately drop back to unprivileged UID 101.
USER 0
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/15-runtime-meta.envsh /docker-entrypoint.d/15-runtime-meta.envsh
RUN chmod 755 /docker-entrypoint.d/15-runtime-meta.envsh

# Restrict envsubst to our explicit variables so $uri / $proxy_host / $scheme stay untouched.
ENV PORT=8080 \
    API_UPSTREAM_URL=http://pulse-backend:8080 \
    APP_VERSION=0.6.0 \
    APP_REVISION=local \
    APP_ENV=local \
    NGINX_ENVSUBST_FILTER="^(PORT|API_UPSTREAM_URL|APP_REVISION|APP_VERSION|APP_ENV|READY_STATUS_CODE|READY_STATUS_TEXT)$"

USER 101
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD ["sh", "-c", "wget -qO- http://127.0.0.1:${PORT:-8080}/readyz >/dev/null || exit 1"]
