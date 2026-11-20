# OpenAPI Contract-First Toolchain Gotchas (`ADR-0005`)

## `springdoc-openapi` `3.2.0` on Spring Boot `4.1.2` + Jackson 3
- **Observed**: Spring Boot `4.1.2` uses Jackson 3 (`tools.jackson.databind.*`, `tools.jackson.core.util.Separators`) rather than `com.fasterxml.jackson.databind.*`, and `ObjectMapper.writer(PrettyPrinter)` moved to `ObjectMapper.writer().with(PrettyPrinter)`. Additionally, `springdoc` inlines Java enums on properties by default, and setting only `schema.setType("string")` on synthetic enum schemas inside an `OpenApiCustomizer` omits `"type": "string"` in OpenAPI 3.1 output.
- **Verified Behavior**: Use `tools.jackson.databind.json.JsonMapper` + `writer().with(printer)`, hoist enums via `OpenApiContractConfig.pulseContractSchemaCustomizer()`, and call `enumSchema.setTypes(Set.of("string"))` for OpenAPI 3.1 serialization.
- **Evidence**: `apps/pulse/backend/gradlew codeQuality exportOpenApiSpec test` exit `0` on 2026-11-19 (`OpenApiContractExportTest`, `apps/pulse/contracts/pulse-api.openapi.json`).

## `org.openapi.generator` `7.27.0` KMP `multiplatform` (`library = "multiplatform"`)
- **Observed**: In Gradle Kotlin DSL, `GenerateTask.outputDir` is a `DirectoryProperty` (calling `.set(provider.map { it.asFile.absolutePath })` fails script compilation). Without `dateLibrary = "kotlinx-datetime"`, `processMultiplatformLibrary` fails at generation time (`Multiplatform only supports string and kotlinx-datetime`). Enum values like `SHRINK_TO_5M` become `SHRINK_TO_5_M` with `@SerialName(value = "SHRINK_TO_5M")`.
- **Verified Behavior**: Pass `outputDir.set(generatedOpenApiDir)`, set `"dateLibrary" to "kotlinx-datetime"`, and use `models = ""`, `apis = "false"`, `supportingFiles = "false"` so generated OpenAPI 3.1 models emit nullable types (`String?`, `Long?`, `Int?`) with zero `java.*`/`android.*` imports across JVM and `wasmJs`.
- **Evidence**: `apps/pulse/kmp/gradlew syncPulseApiModels codeQuality jvmJar compileProductionExecutableKotlinWasmJs jvmTest` exit `0` on 2026-11-19.

## `apps/pulse/web` Vitest Spec File Reads Without `@types/node`
- **Observed**: `apps/pulse/web/node_modules/@types` contains only `chai`, `deep-eql`, and `estree` (no `@types/node`), and `tsconfig.app.json` sets `"types": []`. Static `import fs from 'node:fs'` in a `.spec.ts` fails `npm run typecheck` (`tsc --noEmit`).
- **Verified Behavior**: Use `const fsModule = 'node:fs'; const fs = await import(/* @vite-ignore */ fsModule)` inside Vitest `.spec.ts` files with `new URL(..., import.meta.url)` so both `tsc --noEmit` and `vitest run` succeed without adding `@types/node` or `@ts-ignore`.
- **Evidence**: `apps/pulse/web/npm run lint && npm run typecheck && npm run build && npm test` exit `0` (12/12 tests) on 2026-11-19.

## `oasdiff` `1.39.0` & `oasdiff/oasdiff-action@v0.2.1`
- **Observed**: `oasdiff/oasdiff-action/breaking` and `changelog` require filesystem paths for `base` and `revision` (not `git-ref:path`), and `review` defaults to `'true'` (which uploads client-encrypted specs to `oasdiff.com`).
- **Verified Behavior**: Extract base spec with `git show "origin/${BASE_REF}:${SPEC_PATH}" > "$RUNNER_TEMP/base.json"` and pass `review: "false"`, `github-token: ""`, and `fail-on: ERR`.
- **Evidence**: Inspected `oasdiff/oasdiff-action` `v0.2.1` `action.yml` (`14ca7009a63c417dfe27b7c44359c4bcccaf8eee`) and verified `/opt/homebrew/bin/oasdiff` `1.39.0` via `scripts/api-contract.sh drill` (exit `0`) on 2026-11-19.
