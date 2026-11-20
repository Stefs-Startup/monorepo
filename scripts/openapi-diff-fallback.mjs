#!/usr/bin/env node
/**
 * Zero-dependency OpenAPI 3.0 / 3.1 structural & breaking-change diff engine.
 *
 * Used automatically by `scripts/api-contract.sh` when `CONTRACT_DIFF_TOOL=builtin`
 * or when neither `oasdiff` nor Docker is available locally, and selectable in CI
 * via `diff-tool: builtin`.
 *
 * Usage:
 *   node scripts/openapi-diff-fallback.mjs breaking [--fail-on ERR|WARN|INFO] <base.json> <revision.json>
 *   node scripts/openapi-diff-fallback.mjs changelog [--format markdown|text] <base.json> <revision.json>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function asStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

function normalizeTypes(schema) {
  const rec = asRecord(schema);
  if (typeof rec.type === "string") {
    return [rec.type];
  }
  if (Array.isArray(rec.type)) {
    return rec.type.filter((item) => typeof item === "string").sort();
  }
  if (rec.nullable === true && typeof rec.type === "string") {
    return [rec.type, "null"].sort();
  }
  return [];
}

function describeSchemaRefOrType(schema) {
  const rec = asRecord(schema);
  if (typeof rec.$ref === "string") {
    return rec.$ref;
  }
  const types = normalizeTypes(rec);
  const typeLabel = types.length > 0 ? types.join("|") : "unknown";
  if (types.includes("array") && rec.items) {
    return `${typeLabel}<${describeSchemaRefOrType(rec.items)}>`;
  }
  return typeLabel;
}

function areSchemasCompatible(baseProp, revProp) {
  const baseRec = asRecord(baseProp);
  const revRec = asRecord(revProp);

  const baseRef = typeof baseRec.$ref === "string" ? baseRec.$ref : undefined;
  const revRef = typeof revRec.$ref === "string" ? revRec.$ref : undefined;
  if (baseRef || revRef) {
    return baseRef === revRef;
  }

  const baseTypes = normalizeTypes(baseRec);
  const revTypes = normalizeTypes(revRec);
  if (baseTypes.length !== revTypes.length) {
    return false;
  }
  for (let i = 0; i < baseTypes.length; i += 1) {
    if (baseTypes[i] !== revTypes[i]) {
      return false;
    }
  }

  if (baseTypes.includes("array")) {
    const baseItems = baseRec.items;
    const revItems = revRec.items;
    if (baseItems || revItems) {
      return areSchemasCompatible(baseItems, revItems);
    }
  }

  return true;
}

function parameterKey(param) {
  const rec = asRecord(param);
  return `${String(rec.in ?? "query")}:${String(rec.name ?? "")}`;
}

function collectOperationChanges(pathKey, method, baseOp, revOp, changes) {
  const targetPrefix = `${method.toUpperCase()} ${pathKey}`;
  const baseResponses = asRecord(baseOp.responses);
  const revResponses = asRecord(revOp.responses);

  for (const status of Object.keys(baseResponses).sort()) {
    if (/^2\d\d$/.test(status) && !(status in revResponses)) {
      changes.push({
        severity: "ERR",
        code: "response-success-status-removed",
        target: `${targetPrefix} -> ${status}`,
        message: `Removed success response '${status}' from ${targetPrefix}.`,
      });
    }
  }

  for (const status of Object.keys(revResponses).sort()) {
    if (!(status in baseResponses)) {
      changes.push({
        severity: "INFO",
        code: "response-status-added",
        target: `${targetPrefix} -> ${status}`,
        message: `Added response '${status}' to ${targetPrefix}.`,
      });
    }
  }

  const baseBody = asRecord(baseOp.requestBody);
  const revBody = asRecord(revOp.requestBody);
  if (Object.keys(revBody).length > 0 && baseBody.required !== true && revBody.required === true) {
    changes.push({
      severity: "ERR",
      code: "request-body-became-required",
      target: targetPrefix,
      message: `Request body became required on ${targetPrefix}.`,
    });
  } else if (baseBody.required === true && revBody.required !== true && Object.keys(revBody).length > 0) {
    changes.push({
      severity: "INFO",
      code: "request-body-became-optional",
      target: targetPrefix,
      message: `Request body became optional on ${targetPrefix}.`,
    });
  }

  const baseParams = new Map();
  for (const p of Array.isArray(baseOp.parameters) ? baseOp.parameters : []) {
    baseParams.set(parameterKey(p), asRecord(p));
  }
  for (const p of Array.isArray(revOp.parameters) ? revOp.parameters : []) {
    const revParam = asRecord(p);
    const key = parameterKey(revParam);
    const prevParam = baseParams.get(key);
    if (!prevParam) {
      if (revParam.required === true) {
        changes.push({
          severity: "ERR",
          code: "request-required-parameter-added",
          target: `${targetPrefix} (${key})`,
          message: `Added required parameter '${key}' to ${targetPrefix}.`,
        });
      } else {
        changes.push({
          severity: "INFO",
          code: "request-optional-parameter-added",
          target: `${targetPrefix} (${key})`,
          message: `Added optional parameter '${key}' to ${targetPrefix}.`,
        });
      }
    } else if (prevParam.required !== true && revParam.required === true) {
      changes.push({
        severity: "ERR",
        code: "request-parameter-became-required",
        target: `${targetPrefix} (${key})`,
        message: `Optional parameter '${key}' became required on ${targetPrefix}.`,
      });
    }
  }
}

function collectComponentSchemaChanges(baseSpec, revSpec, changes) {
  const baseSchemas = asRecord(asRecord(baseSpec.components).schemas);
  const revSchemas = asRecord(asRecord(revSpec.components).schemas);

  for (const schemaName of Object.keys(baseSchemas).sort()) {
    if (!(schemaName in revSchemas)) {
      changes.push({
        severity: "ERR",
        code: "schema-removed",
        target: `components.schemas.${schemaName}`,
        message: `Removed schema 'components.schemas.${schemaName}'.`,
      });
      continue;
    }

    const baseSchema = asRecord(baseSchemas[schemaName]);
    const revSchema = asRecord(revSchemas[schemaName]);

    // Enum checks
    const baseEnums = Array.isArray(baseSchema.enum) ? baseSchema.enum.map(String) : [];
    const revEnums = Array.isArray(revSchema.enum) ? revSchema.enum.map(String) : [];
    const revEnumSet = new Set(revEnums);
    const baseEnumSet = new Set(baseEnums);

    for (const val of baseEnums) {
      if (!revEnumSet.has(val)) {
        changes.push({
          severity: "ERR",
          code: "enum-value-removed",
          target: `${schemaName}.${val}`,
          message: `Removed enum value '${val}' from '${schemaName}'.`,
        });
      }
    }
    for (const val of revEnums) {
      if (!baseEnumSet.has(val)) {
        changes.push({
          severity: "INFO",
          code: "enum-value-added",
          target: `${schemaName}.${val}`,
          message: `Added enum value '${val}' to '${schemaName}'.`,
        });
      }
    }

    // Object property checks
    const baseProps = asRecord(baseSchema.properties);
    const revProps = asRecord(revSchema.properties);
    const baseRequired = new Set(asStringArray(baseSchema.required));
    const revRequired = new Set(asStringArray(revSchema.required));

    for (const propName of Object.keys(baseProps).sort()) {
      if (!(propName in revProps)) {
        changes.push({
          severity: "ERR",
          code: "property-removed",
          target: `${schemaName}.${propName}`,
          message: `Removed property '${propName}' from schema '${schemaName}'.`,
        });
        continue;
      }

      if (!areSchemasCompatible(baseProps[propName], revProps[propName])) {
        changes.push({
          severity: "ERR",
          code: "property-type-changed",
          target: `${schemaName}.${propName}`,
          message: `Changed type of '${schemaName}.${propName}' (${describeSchemaRefOrType(baseProps[propName])} -> ${describeSchemaRefOrType(revProps[propName])}).`,
        });
      }

      if (!baseRequired.has(propName) && revRequired.has(propName)) {
        changes.push({
          severity: "ERR",
          code: "property-became-required",
          target: `${schemaName}.${propName}`,
          message: `Optional property '${schemaName}.${propName}' became required.`,
        });
      } else if (baseRequired.has(propName) && !revRequired.has(propName)) {
        changes.push({
          severity: "INFO",
          code: "property-became-optional",
          target: `${schemaName}.${propName}`,
          message: `Required property '${schemaName}.${propName}' became optional.`,
        });
      }
    }

    for (const propName of Object.keys(revProps).sort()) {
      if (!(propName in baseProps)) {
        if (revRequired.has(propName)) {
          changes.push({
            severity: "ERR",
            code: "required-property-added",
            target: `${schemaName}.${propName}`,
            message: `Added new required property '${schemaName}.${propName}'.`,
          });
        } else {
          changes.push({
            severity: "INFO",
            code: "optional-property-added",
            target: `${schemaName}.${propName}`,
            message: `Added optional property '${schemaName}.${propName}' (${describeSchemaRefOrType(revProps[propName])}).`,
          });
        }
      }
    }
  }

  for (const schemaName of Object.keys(revSchemas).sort()) {
    if (!(schemaName in baseSchemas)) {
      changes.push({
        severity: "INFO",
        code: "schema-added",
        target: `components.schemas.${schemaName}`,
        message: `Added schema 'components.schemas.${schemaName}'.`,
      });
    }
  }
}

/**
 * Computes structural OpenAPI 3.0 / 3.1 differences grouped by severity (ERR | INFO).
 */
export function diffOpenApiSpecs(baseSpec, revSpec) {
  const changes = [];
  const basePaths = asRecord(asRecord(baseSpec).paths);
  const revPaths = asRecord(asRecord(revSpec).paths);

  for (const pathKey of Object.keys(basePaths).sort()) {
    if (!(pathKey in revPaths)) {
      changes.push({
        severity: "ERR",
        code: "endpoint-path-removed",
        target: pathKey,
        message: `Removed API path '${pathKey}'.`,
      });
      continue;
    }

    const baseItem = asRecord(basePaths[pathKey]);
    const revItem = asRecord(revPaths[pathKey]);
    for (const method of HTTP_METHODS) {
      const hasBase = method in baseItem;
      const hasRev = method in revItem;
      if (hasBase && !hasRev) {
        changes.push({
          severity: "ERR",
          code: "endpoint-removed",
          target: `${method.toUpperCase()} ${pathKey}`,
          message: `Removed operation '${method.toUpperCase()} ${pathKey}'.`,
        });
      } else if (!hasBase && hasRev) {
        changes.push({
          severity: "INFO",
          code: "endpoint-added",
          target: `${method.toUpperCase()} ${pathKey}`,
          message: `Added operation '${method.toUpperCase()} ${pathKey}'.`,
        });
      } else if (hasBase && hasRev) {
        collectOperationChanges(
          pathKey,
          method,
          asRecord(baseItem[method]),
          asRecord(revItem[method]),
          changes,
        );
      }
    }
  }

  for (const pathKey of Object.keys(revPaths).sort()) {
    if (!(pathKey in basePaths)) {
      changes.push({
        severity: "INFO",
        code: "endpoint-path-added",
        target: pathKey,
        message: `Added API path '${pathKey}'.`,
      });
    }
  }

  collectComponentSchemaChanges(baseSpec, revSpec, changes);

  const errors = changes.filter((c) => c.severity === "ERR");
  const infos = changes.filter((c) => c.severity === "INFO");
  return { changes, errors, infos };
}

/**
 * Formats diff output for CLI `breaking` or `changelog` commands.
 */
export function formatDiffOutput(diff, mode, format = "text") {
  if (mode === "breaking") {
    if (diff.errors.length === 0) {
      return `0 breaking changes (${diff.infos.length} additive/non-breaking change(s)).`;
    }
    const header = `${diff.errors.length} breaking change(s) detected (builtin OpenAPI diff):`;
    const items = diff.errors.map(
      (err) => `error [${err.code}] at ${err.target}: ${err.message}`,
    );
    return [header, ...items].join("\n");
  }

  if (diff.changes.length === 0) {
    return "No API changes detected.";
  }

  if (format === "markdown") {
    const sections = [];
    if (diff.errors.length > 0) {
      sections.push("#### Breaking Changes");
      for (const err of diff.errors) {
        sections.push(`- **ERR** \`${err.code}\` (\`${err.target}\`): ${err.message}`);
      }
    }
    if (diff.infos.length > 0) {
      sections.push("#### Additive / Non-Breaking Changes");
      for (const info of diff.infos) {
        sections.push(`- **INFO** \`${info.code}\` (\`${info.target}\`): ${info.message}`);
      }
    }
    return sections.join("\n");
  }

  return diff.changes
    .map((c) => `${c.severity.toLowerCase()} [${c.code}] ${c.target}: ${c.message}`)
    .join("\n");
}

function readJsonSpec(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`OpenAPI spec file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function runFallbackCli(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") {
    console.log(
      "Usage: openapi-diff-fallback.mjs <breaking|changelog> [--fail-on ERR] [--format markdown|text] <base.json> <revision.json>",
    );
    return 0;
  }
  if (command !== "breaking" && command !== "changelog") {
    console.error(`Unknown subcommand: ${command}`);
    return 2;
  }

  let failOn = "";
  let format = "text";
  const positionals = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--fail-on") {
      failOn = String(rest[++i] ?? "").toUpperCase();
    } else if (arg.startsWith("--fail-on=")) {
      failOn = arg.slice("--fail-on=".length).toUpperCase();
    } else if (arg === "--format") {
      format = String(rest[++i] ?? "text").toLowerCase();
    } else if (arg.startsWith("--format=")) {
      format = arg.slice("--format=".length).toLowerCase();
    } else if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }

  const [basePath, revisionPath] = positionals;
  if (!basePath || !revisionPath) {
    console.error("Both <base.json> and <revision.json> file paths are required.");
    return 2;
  }

  try {
    const baseSpec = readJsonSpec(basePath);
    const revSpec = readJsonSpec(revisionPath);
    const diff = diffOpenApiSpecs(baseSpec, revSpec);
    const rendered = formatDiffOutput(diff, command, format);
    console.log(rendered);

    if (failOn === "ERR" && diff.errors.length > 0) {
      return 1;
    }
    if (failOn === "INFO" && diff.changes.length > 0) {
      return 1;
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

function isExecutedDirectly() {
  if (!process.argv[1]) {
    return false;
  }
  try {
    const invoked = fs.realpathSync(path.resolve(process.argv[1]));
    const current = fs.realpathSync(fileURLToPath(import.meta.url));
    return invoked === current;
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  process.exitCode = runFallbackCli(process.argv.slice(2));
}
