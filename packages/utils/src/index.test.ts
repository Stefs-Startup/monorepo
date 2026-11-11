import { formatWorkspaceBanner, hello, isValidWorkspaceScope } from "./index.js";

function assertEqual<T>(actual: T, expected: T, description: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed [${description}]: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

assertEqual(hello(), "world", "hello() returns canonical world greeting");
assertEqual(
  formatWorkspaceBanner("@cmp/web"),
  "[@cmp/web] world",
  "formatWorkspaceBanner() formats default greeting"
);
assertEqual(
  formatWorkspaceBanner("  @cmp/web  ", "ready"),
  "[@cmp/web] ready",
  "formatWorkspaceBanner() trims app name and applies custom message"
);
assertEqual(isValidWorkspaceScope("@cmp/web"), true, "@cmp/web is valid workspace scope");
assertEqual(isValidWorkspaceScope("@cmp/utils"), true, "@cmp/utils is valid workspace scope");
assertEqual(isValidWorkspaceScope("unscoped-pkg"), false, "unscoped package is rejected");

console.log("PASS @cmp/utils: 6/6 assertions succeeded.");
