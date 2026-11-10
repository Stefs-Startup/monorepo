import { getWebAppGreeting } from "./index.js";

function assertEqual<T>(actual: T, expected: T, description: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed [${description}]: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

assertEqual(
  getWebAppGreeting(),
  "[@cmp/web] world",
  "@cmp/web resolves formatted greeting from @cmp/utils"
);

console.log("PASS @cmp/web: 1/1 assertion succeeded.");
