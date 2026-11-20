interface PromptQuestion {
  type: string;
  name: string;
  message: string;
  default?: string;
  validate?: (input: string) => boolean | string;
}

interface GeneratorAction {
  type: string;
  destination: string;
  base?: string;
  templateFiles?: string | string[];
  templateFile?: string;
  force?: boolean;
}

interface PlopGeneratorConfig {
  description: string;
  prompts: PromptQuestion[];
  actions: GeneratorAction[];
}

interface PlopApi {
  setGenerator: (name: string, config: PlopGeneratorConfig) => void;
}

const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9-]*$/;

function createTsLibraryGenerator(): PlopGeneratorConfig {
  return {
    description:
      "Generate a new TypeScript library package in packages/ extending @cmp/config",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Package name (kebab-case, without @cmp/ scope):",
        validate: (input: string) => {
          const trimmed = input.trim();
          if (!trimmed) {
            return "Package name is required.";
          }
          if (!KEBAB_CASE_PATTERN.test(trimmed)) {
            return "Package name must be lowercase kebab-case matching /^[a-z][a-z0-9-]*$/.";
          }
          return true;
        },
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

export default function generator(plop: PlopApi): void {
  plop.setGenerator("lib", createTsLibraryGenerator());
  plop.setGenerator("ts-library", createTsLibraryGenerator());
}
