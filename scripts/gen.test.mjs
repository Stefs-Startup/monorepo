import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTurboArgs } from "./gen.mjs";

describe("scripts/gen.mjs buildTurboArgs", () => {
  it("passes interactive mode through when no args are given", () => {
    assert.deepEqual(buildTurboArgs([]), ["gen"]);
    assert.deepEqual(buildTurboArgs(["--"]), ["gen"]);
  });

  it("maps pnpm gen lib <name> to turbo gen lib --args", () => {
    assert.deepEqual(buildTurboArgs(["lib", "foo"]), [
      "gen",
      "lib",
      "--args",
      "foo",
      "Shared TypeScript library for the CMP monorepo",
    ]);
  });

  it("maps pnpm gen app web <name> to turbo gen app-web --args (STE-46)", () => {
    assert.deepEqual(buildTurboArgs(["app", "web", "portal"]), [
      "gen",
      "app-web",
      "--args",
      "portal",
      "Angular 21 Signals web application",
    ]);
  });

  it("maps pnpm gen app service <name> [--infra] to turbo gen app-service --args (STE-47)", () => {
    assert.deepEqual(buildTurboArgs(["app", "service", "billing"]), [
      "gen",
      "app-service",
      "--args",
      "billing",
      "Spring Boot 4 / Java 21 backend service",
      "no",
    ]);

    assert.deepEqual(
      buildTurboArgs(["app", "service", "billing", "--infra"]),
      [
        "gen",
        "app-service",
        "--args",
        "billing",
        "Spring Boot 4 / Java 21 backend service",
        "yes",
      ],
    );
  });

  it("maps pnpm gen app android <name> to turbo gen app-android --args (STE-48)", () => {
    assert.deepEqual(buildTurboArgs(["app", "android", "companion"]), [
      "gen",
      "app-android",
      "--args",
      "companion",
      "Android Kotlin + Jetpack Compose application",
    ]);
  });
});
