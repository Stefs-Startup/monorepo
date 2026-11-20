export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    // Dependabot / Renovate multi-scope or dependency bump commits
    (message) => /^chore\([^)]+\)\(deps\):/.test(message),
    (message) => /^chore\(deps\):/.test(message),
    (message) => /^Signed-off-by:\s*dependabot\[bot\]/m.test(message),
    // GitHub merge commits
    (message) => /^Merge\b/.test(message),
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'],
    ],
    'header-max-length': [2, 'always', 120],
    'body-max-line-length': [0, 'always', Infinity],
  },
};
