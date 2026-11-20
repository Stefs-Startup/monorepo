import fs from "node:fs";
import path from "node:path";

interface PromptQuestion {
  type: string;
  name: string;
  message: string;
  default?: string;
  choices?: string[];
  validate?: (input: string) => boolean | string;
}

interface AddManyAction {
  type: string;
  destination: string;
  base?: string;
  templateFiles?: string | string[];
  templateFile?: string;
  force?: boolean;
}

type CustomActionFn = (answers: Record<string, string>) => string;
type GeneratorAction = AddManyAction | CustomActionFn;

interface PlopGeneratorConfig {
  description: string;
  prompts: PromptQuestion[];
  actions: GeneratorAction[];
}

interface PlopApi {
  setGenerator: (name: string, config: PlopGeneratorConfig) => void;
}

const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9-]*$/;

function toDashCase(input: string): string {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function validateKebabName(input: string): boolean | string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "Name is required.";
  }
  if (!KEBAB_CASE_PATTERN.test(trimmed)) {
    return "Name must be lowercase kebab-case matching /^[a-z][a-z0-9-]*$/.";
  }
  return true;
}

function copyGradleWrapper(targetAppSlug: string, sourceRelDir: string): string {
  const rootDir = process.cwd();
  const sourceDir = path.join(rootDir, sourceRelDir);
  const targetDir = path.join(rootDir, "apps", targetAppSlug);

  for (const wrapperScript of ["gradlew", "gradlew.bat"]) {
    const srcFile = path.join(sourceDir, wrapperScript);
    const dstFile = path.join(targetDir, wrapperScript);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, dstFile);
      if (wrapperScript === "gradlew") {
        fs.chmodSync(dstFile, 0o755);
      }
    }
  }

  const srcWrapperDir = path.join(sourceDir, "gradle", "wrapper");
  const dstWrapperDir = path.join(targetDir, "gradle", "wrapper");
  if (fs.existsSync(srcWrapperDir)) {
    fs.mkdirSync(dstWrapperDir, { recursive: true });
    for (const entry of fs.readdirSync(srcWrapperDir)) {
      fs.copyFileSync(
        path.join(srcWrapperDir, entry),
        path.join(dstWrapperDir, entry),
      );
    }
  }

  return `Copied Gradle wrapper into apps/${targetAppSlug}`;
}

function writeServiceComposeFile(targetAppSlug: string): string {
  const rootDir = process.cwd();
  const composePath = path.join(rootDir, "apps", targetAppSlug, "compose.yaml");
  const dbName = targetAppSlug.replace(/-/g, "_");
  const content = `# Optional local Postgres + Redis infrastructure for ${targetAppSlug} (STE-47)
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${dbName}
      POSTGRES_USER: ${dbName}
      POSTGRES_PASSWORD: local_dev_password
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${dbName}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
`;
  fs.writeFileSync(composePath, content, "utf8");
  return `Added apps/${targetAppSlug}/compose.yaml (Postgres + Redis)`;
}

function createTsLibraryGenerator(): PlopGeneratorConfig {
  return {
    description:
      "Generate a new TypeScript library package in packages/ extending @cmp/config (STE-45)",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Package name (kebab-case, without @cmp/ scope):",
        validate: validateKebabName,
      },
      {
        type: "input",
        name: "description",
        message: "Short package description:",
        default: "Shared TypeScript library for the CMP monorepo",
      },
    ],
    actions: [
      {
        type: "addMany",
        destination: "packages/{{dashCase name}}",
        base: "templates/ts-library",
        templateFiles: "templates/ts-library/**",
      },
    ],
  };
}

function createWebAppGenerator(): PlopGeneratorConfig {
  return {
    description:
      "Generate an Angular 21 Signals web application in apps/<name> extending @cmp/config (STE-46)",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Web app name (kebab-case):",
        validate: validateKebabName,
      },
      {
        type: "input",
        name: "description",
        message: "Short web app description:",
        default: "Angular 21 Signals web application",
      },
    ],
    actions: [
      {
        type: "addMany",
        destination: "apps/{{dashCase name}}",
        base: "templates/app-web",
        templateFiles: "templates/app-web/**",
      },
    ],
  };
}

function createServiceAppGenerator(): PlopGeneratorConfig {
  return {
    description:
      "Generate a Spring Boot 4 / Java 21 service in apps/<name> using stefs.jvm-service (STE-47)",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Service name (kebab-case):",
        validate: validateKebabName,
      },
      {
        type: "input",
        name: "description",
        message: "Short service description:",
        default: "Spring Boot 4 / Java 21 backend service",
      },
      {
        type: "input",
        name: "includeInfra",
        message: "Include compose.yaml for Postgres/Redis? (yes/no):",
        default: "no",
      },
    ],
    actions: [
      {
        type: "addMany",
        destination: "apps/{{dashCase name}}",
        base: "templates/app-service",
        templateFiles: "templates/app-service/**",
      },
      (answers: Record<string, string>) => {
        const slug = toDashCase(answers.name || "");
        return copyGradleWrapper(slug, "apps/pulse/backend");
      },
      (answers: Record<string, string>) => {
        const slug = toDashCase(answers.name || "");
        const infra = String(answers.includeInfra || "no")
          .trim()
          .toLowerCase();
        if (infra === "yes" || infra === "true") {
          return writeServiceComposeFile(slug);
        }
        return `Skipped compose.yaml for apps/${slug} (pass --infra to include)`;
      },
    ],
  };
}

function createAndroidAppGenerator(): PlopGeneratorConfig {
  return {
    description:
      "Generate an Android (Kotlin / Jetpack Compose) app in apps/<name> using stefs.android-app (STE-48)",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Android app name (kebab-case):",
        validate: validateKebabName,
      },
      {
        type: "input",
        name: "description",
        message: "Short Android app description:",
        default: "Android Kotlin + Jetpack Compose application",
      },
    ],
    actions: [
      {
        type: "addMany",
        destination: "apps/{{dashCase name}}",
        base: "templates/app-android",
        templateFiles: "templates/app-android/**",
      },
      (answers: Record<string, string>) => {
        const slug = toDashCase(answers.name || "");
        return copyGradleWrapper(slug, "apps/pulse");
      },
    ],
  };
}

export default function generator(plop: PlopApi): void {
  plop.setGenerator("lib", createTsLibraryGenerator());
  plop.setGenerator("ts-library", createTsLibraryGenerator());
  plop.setGenerator("app-web", createWebAppGenerator());
  plop.setGenerator("app-service", createServiceAppGenerator());
  plop.setGenerator("app-android", createAndroidAppGenerator());
}
