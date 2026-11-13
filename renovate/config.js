// =============================================================================
// Self-Hosted Renovate OSS Global Configuration (config.js)
// =============================================================================
// Zero external SaaS dependencies: runs via the open-source renovate/renovate
// CLI or Docker image against GitHub / GitHub Enterprise / local git checkouts.
//
// Defaults to dryRun: "full" for safe side-by-side comparison against
// .github/dependabot.yml. Set RENOVATE_DRY_RUN=false explicitly when ready to
// open live branches/PRs.
// =============================================================================

const fs = require('node:fs');
const path = require('node:path');

/**
 * Strips JSONC line/block comments and trailing commas without altering string
 * literals (such as https:// URLs or regex patterns containing //).
 */
function parseJsonc(raw) {
  let out = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    out += ch;
  }

  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

function loadPortableRepoConfig() {
  const candidate = path.join(__dirname, 'renovate.jsonc');
  if (!fs.existsSync(candidate)) {
    return {};
  }
  const parsed = parseJsonc(fs.readFileSync(candidate, 'utf8'));
  delete parsed.$schema;
  return parsed;
}

function resolveDryRun() {
  const raw = process.env.RENOVATE_DRY_RUN;
  if (raw === undefined || raw === '') {
    return 'full';
  }
  if (raw === 'false' || raw === 'null' || raw === 'none') {
    return null;
  }
  return raw;
}

function resolveRepositories() {
  if (process.env.RENOVATE_REPOSITORIES) {
    return process.env.RENOVATE_REPOSITORIES.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (process.env.GITHUB_REPOSITORY) {
    return [process.env.GITHUB_REPOSITORY];
  }
  return ['Stefs-Startup/monorepo'];
}

const platform = process.env.RENOVATE_PLATFORM || 'github';
const portableRepoConfig = loadPortableRepoConfig();

module.exports = {
  ...portableRepoConfig,

  // Platform & self-hosted authentication (no Mend/WhiteSource cloud calls)
  platform,
  ...(process.env.RENOVATE_ENDPOINT ? { endpoint: process.env.RENOVATE_ENDPOINT } : {}),
  ...(platform === 'local' ? {} : { repositories: resolveRepositories() }),

  // Dry-run by default ("full") for safe Dependabot comparison; local platform
  // automatically falls back to "lookup" inside Renovate.
  dryRun: resolveDryRun(),

  // Apply renovate/renovate.jsonc directly without opening an onboarding PR
  onboarding: false,
  requireConfig: 'optional',

  // Bot identity for local git commits when dryRun is disabled
  gitAuthor: process.env.RENOVATE_GIT_AUTHOR || 'Renovate Bot <renovate-bot@users.noreply.github.com>',

  // Keep experimental Backstage excluded even if a repo lacks local ignorePaths
  ignorePaths: portableRepoConfig.ignorePaths || [
    '**/node_modules/**',
    '**/build/**',
    '**/dist/**',
    '**/.gradle/**',
    'apps/backstage/**',
    '**/apps/backstage/**',
  ],

  // Security allowlist for postUpgradeTasks — shell executor remains disabled
  // (false) so chained shell operators cannot bypass anchored regex patterns.
  allowShellExecutorForPostUpgradeCommands: false,
  allowedCommands: [
    '^\\./gradlew --no-daemon rewriteRun$',
    '^mvn -B -ntp rewrite:run$',
    '^npm ci --ignore-scripts$',
    '^npx --no-install ng update @angular/[a-z0-9-]+ --migrate-only --from=[0-9A-Za-z.+-]+ --to=[0-9A-Za-z.+-]+ --allow-dirty --force$',
  ],

  // Avoid leaking internal host metadata or calling proprietary endpoints
  printConfig: process.env.RENOVATE_PRINT_CONFIG === 'true',
  persistRepoData: false,
};
