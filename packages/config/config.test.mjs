import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as eslintPresets from "./eslint.config.mjs";
import * as prettierPresets from "./prettier.config.mjs";

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CONFIG_DIR, "../..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveStrictFlag(tsconfigPath) {
  const visited = new Set();
  let current = path.resolve(tsconfigPath);
  while (current && !visited.has(current)) {
    visited.add(current);
    const parsed = readJson(current);
    if (typeof parsed.compilerOptions?.strict === "boolean") {
      return parsed.compilerOptions.strict;
    }
    if (typeof parsed.extends !== "string") {
      break;
    }
    if (parsed.extends.startsWith("@cmp/config/")) {
      current = path.join(CONFIG_DIR, parsed.extends.slice("@cmp/config/".length));
    } else {
      current = path.resolve(path.dirname(current), parsed.extends);
    }
  }
  return undefined;
}

test("all shared tsconfig presets exist and enforce strict: true", () => {
  for (const name of ["base", "library", "node", "angular"]) {
    const presetPath = path.join(CONFIG_DIR, `tsconfig.${name}.json`);
    assert.equal(fs.existsSync(presetPath), true, `Missing tsconfig.${name}.json`);
    assert.equal(resolveStrictFlag(presetPath), true, `tsconfig.${name}.json must inherit strict: true`);
  }
});

test("eslint and prettier configs export base, node, library, and angular presets", () => {
  for (const name of ["base", "node", "library", "angular"]) {
    assert.ok(Array.isArray(eslintPresets[name]), `eslint preset '${name}' must be a flat-config array`);
    assert.ok(eslintPresets[name].length > 0, `eslint preset '${name}' must be non-empty`);
    assert.equal(typeof prettierPresets[name], "object", `prettier preset '${name}' must be an object`);
    assert.equal(typeof prettierPresets[name].printWidth, "number");
  }
});

test("workspace packages and standalone apps/pulse/web extend shared @cmp/config presets", () => {
  const expectedConsumers = [
    ["apps/web/tsconfig.json", "@cmp/config/tsconfig.library.json"],
    ["packages/utils/tsconfig.json", "@cmp/config/tsconfig.library.json"],
    ["packages/factory/tsconfig.json", "@cmp/config/tsconfig.node.json"],
    ["tools/blast-radius/tsconfig.json", "../../packages/config/tsconfig.node.json"],
    ["apps/pulse/web/tsconfig.json", "../../../packages/config/tsconfig.angular.json"],
  ];

  for (const [relPath, expectedExtends] of expectedConsumers) {
    const fullPath = path.join(REPO_ROOT, relPath);
    const parsed = readJson(fullPath);
    assert.equal(parsed.extends, expectedExtends, `${relPath} must extend ${expectedExtends}`);
    assert.equal(resolveStrictFlag(fullPath), true, `${relPath} must resolve strict: true`);
  }
});
