# @cmp/blast-radius

Deterministic Dependency Blast-Radius & Critical-Path AST CLI for the CMP monorepo.

## Capabilities

- **Multi-Ecosystem Dependency Delta Extraction** (`--base <ref>` default `main` / `origin/main`):
  - **Gradle**: `build.gradle.kts`, `gradle/libs.versions.toml`, and `./gradlew dependencies` text output (`--gradle-base` / `--gradle-head`)
  - **Maven**: `pom.xml` (`--pom-base` / `--pom-head`) and `mvn dependency:tree -DoutputType=json` (`--maven-tree-base` / `--maven-tree-head`)
  - **npm**: `package-lock.json` v1/v2/v3 (`--npm-lock-base` / `--npm-lock-head`)
  - **pnpm**: `pnpm-lock.yaml` v6/v9 (`--pnpm-lock-base` / `--pnpm-lock-head`)
  - **SBOM Cross-Check**: CycloneDX, SPDX, or GitHub Dependency Graph JSON (`--sbom <file>` or `--fetch-sbom` via `gh api`, with non-fatal offline fallback)
- **AST & Critical-Path Mapping**:
  - **Java 21 (`java-parser` CST)**: Maps changed coordinates to imports, classes, records, methods, and Spring annotations (`@RestController`, `@Controller`, `@Service`, `@Repository`, `@Transactional`, `@SecurityFilterChain`, `@Configuration`, `@Bean`, `@SpringBootApplication`, `@ExceptionHandler`, DTO records) with exact file paths and line numbers.
  - **Angular / TypeScript (`ts-morph`)**: Maps changed npm/pnpm packages to `@Component`, `@Injectable`, Signals (`signal`, `computed`, `effect`, `toSignal`), RxJS pipelines (`pipe`, `subscribe`), and DTO interfaces (`models/*.ts`) with exact file paths and line numbers.
- **Deterministic Scoring, PR Markdown & Gate Exit Codes**:
  - `HIGH CONFIDENCE / AUTO-MERGE`: exit `0`
  - `MODERATE - VERIFY TESTS`: exit `10` with `--gate` (`0` with `--allow-moderate`)
  - `CRITICAL PATH TOUCHED - MANUAL REVIEW`: exit `20` with `--gate`

## Usage

```bash
pnpm --filter @cmp/blast-radius build
node tools/blast-radius/dist/src/cli.js --base origin/main --out blast-radius-report.json --md-out blast-radius-summary.md --gate
```
