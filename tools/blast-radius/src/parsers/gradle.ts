import { inferJavaPackages } from "../mappings/package-map.js";
import type { DependencyDelta } from "../types.js";
import { classifyVersionBump } from "../utils/semver.js";

export interface ParsedGradleDep {
  coord: string;
  group: string;
  artifact: string;
  version: string;
  direct: boolean;
  sourceFile: string;
}

/**
 * Parses `./gradlew dependencies` text output into a map of group:artifact -> ParsedGradleDep.
 */
export function parseGradleDependenciesText(
  raw: string,
  sourceFile: string,
  warnings: string[],
): Map<string, ParsedGradleDep> {
  const deps = new Map<string, ParsedGradleDep>();
  if (!raw.trim()) return deps;

  const lines = raw.split(/\r?\n/);
  let sawTreeLine = false;

  for (const line of lines) {
    // Match lines like:
    // +--- org.springframework.boot:spring-boot-starter-webmvc:4.1.2
    // |    \--- com.fasterxml.jackson.core:jackson-databind:2.18.0 -> 2.18.2 (*)
    // \--- org.junit.jupiter:junit-jupiter -> 5.11.4 (c)
    const treeMatch = /^([|+\\ ]*?)(\+---|\\---)\s+(.+)$/.exec(line);
    if (!treeMatch) continue;
    sawTreeLine = true;

    const prefix = treeMatch[1] ?? "";
    const direct = prefix.trim().length === 0;
    let body = treeMatch[3]
      .replace(/\s+\(\*\)\s*$/, "")
      .replace(/\s+\(c\)\s*$/, "")
      .replace(/\s+\(n\)\s*$/, "")
      .trim();

    if (!body || body.startsWith("project ")) continue;

    // Handle `group:artifact:requested -> resolved` or `group:artifact -> resolved`
    let resolvedOverride: string | null = null;
    if (body.includes(" -> ")) {
      const arrowParts = body.split(" -> ");
      body = arrowParts[0].trim();
      resolvedOverride = arrowParts[arrowParts.length - 1].trim();
    }

    const parts = body.split(":");
    if (parts.length < 2) continue;
    const group = parts[0].trim();
    const artifact = parts[1].trim();
    const declaredVersion = parts[2]?.trim() || "";
    const version = (resolvedOverride || declaredVersion).replace(/\s+\(.*\)$/, "").trim();
    if (!group || !artifact || !version) continue;

    const coord = `${group}:${artifact}`;
    const existing = deps.get(coord);
    if (!existing || (direct && !existing.direct)) {
      deps.set(coord, {
        coord,
        group,
        artifact,
        version,
        direct,
        sourceFile,
      });
    }
  }

  if (!sawTreeLine && raw.trim().length > 0 && !raw.includes("No dependencies")) {
    warnings.push(
      `Gradle dependency text in ${sourceFile} contained no recognizable '+---' or '\\---' tree entries.`,
    );
  }

  return deps;
}

/**
 * Parses a Gradle `libs.versions.toml` version catalog.
 */
export function parseGradleVersionCatalog(
  raw: string,
  sourceFile: string,
  warnings: string[],
): Map<string, ParsedGradleDep> {
  const deps = new Map<string, ParsedGradleDep>();
  if (!raw.trim()) return deps;

  const versions = new Map<string, string>();
  let section = "";

  const lines = raw.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const sectionMatch = /^\[([A-Za-z0-9_.-]+)\]$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim().replace(/^["']|["']$/g, "");
    const valueRaw = line.slice(eqIdx + 1).trim();

    if (section === "versions") {
      const strMatch = /^["']([^"']+)["']$/.exec(valueRaw);
      if (strMatch) {
        versions.set(key, strMatch[1]);
      }
    } else if (section === "libraries") {
      // Formats:
      // key = "group:artifact:version"
      // key = { group = "g", name = "a", version.ref = "v" }
      // key = { module = "g:a", version = "1.0.0" }
      const shortMatch = /^["']([^"']+)["']$/.exec(valueRaw);
      if (shortMatch) {
        const parts = shortMatch[1].split(":");
        if (parts.length >= 3) {
          const [group, artifact, version] = parts;
          const coord = `${group}:${artifact}`;
          deps.set(coord, { coord, group, artifact, version, direct: true, sourceFile });
        }
        continue;
      }

      if (valueRaw.startsWith("{")) {
        const groupMatch = /\bgroup\s*=\s*["']([^"']+)["']/.exec(valueRaw);
        const nameMatch = /\bname\s*=\s*["']([^"']+)["']/.exec(valueRaw);
        const moduleMatch = /\bmodule\s*=\s*["']([^"']+)["']/.exec(valueRaw);
        const versionDirectMatch = /\bversion\s*=\s*["']([^"']+)["']/.exec(valueRaw);
        const versionRefMatch = /\bversion\.ref\s*=\s*["']([^"']+)["']/.exec(valueRaw);

        let group = groupMatch?.[1] ?? "";
        let artifact = nameMatch?.[1] ?? "";
        if (moduleMatch && moduleMatch[1].includes(":")) {
          const [g, a] = moduleMatch[1].split(":");
          group = g;
          artifact = a;
        }
        const version =
          versionDirectMatch?.[1] ??
          (versionRefMatch ? versions.get(versionRefMatch[1]) : undefined) ??
          "";

        if (group && artifact && version) {
          const coord = `${group}:${artifact}`;
          deps.set(coord, { coord, group, artifact, version, direct: true, sourceFile });
        }
      }
    } else if (section === "plugins") {
      const idMatch = /\bid\s*=\s*["']([^"']+)["']/.exec(valueRaw);
      const versionDirectMatch = /\bversion\s*=\s*["']([^"']+)["']/.exec(valueRaw);
      const versionRefMatch = /\bversion\.ref\s*=\s*["']([^"']+)["']/.exec(valueRaw);
      const shortMatch = /^["']([^"':]+):([^"']+)["']$/.exec(valueRaw);

      const pluginId = idMatch?.[1] ?? shortMatch?.[1] ?? "";
      const version =
        versionDirectMatch?.[1] ??
        (versionRefMatch ? versions.get(versionRefMatch[1]) : undefined) ??
        shortMatch?.[2] ??
        "";

      if (pluginId && version) {
        const coord = `${pluginId}:${pluginId}.gradle.plugin`;
        deps.set(coord, {
          coord,
          group: pluginId,
          artifact: `${pluginId}.gradle.plugin`,
          version,
          direct: true,
          sourceFile,
        });
      }
    }
  }

  if (raw.trim().length > 0 && versions.size === 0 && deps.size === 0 && !raw.includes("[")) {
    warnings.push(`Gradle version catalog ${sourceFile} had no TOML sections.`);
  }

  return deps;
}

/**
 * Parses `build.gradle.kts` / `build.gradle` plugin and dependency blocks.
 */
export function parseGradleBuildScript(
  raw: string,
  sourceFile: string,
): Map<string, ParsedGradleDep> {
  const deps = new Map<string, ParsedGradleDep>();
  if (!raw.trim()) return deps;

  let springBootVersion: string | null = null;
  const bomManagedCoords: Array<{ group: string; artifact: string }> = [];

  // Match plugins: id("org.springframework.boot") version "4.1.2" or id 'org.springframework.boot' version '4.1.2'
  const pluginRegex =
    /id\s*\(?\s*["']([^"']+)["']\s*\)?\s*(?:apply\s+(?:true|false)\s*)?version\s*\(?\s*["']([^"']+)["']\s*\)?/g;
  let m: RegExpExecArray | null;
  while ((m = pluginRegex.exec(raw)) !== null) {
    const pluginId = m[1].trim();
    const version = m[2].trim();
    if (pluginId === "org.springframework.boot") {
      springBootVersion = version;
      deps.set("org.springframework.boot:spring-boot-gradle-plugin", {
        coord: "org.springframework.boot:spring-boot-gradle-plugin",
        group: "org.springframework.boot",
        artifact: "spring-boot-gradle-plugin",
        version,
        direct: true,
        sourceFile,
      });
    } else {
      const coord = `${pluginId}:${pluginId}.gradle.plugin`;
      deps.set(coord, {
        coord,
        group: pluginId,
        artifact: `${pluginId}.gradle.plugin`,
        version,
        direct: true,
        sourceFile,
      });
    }
  }

  // Match dependency declarations:
  // implementation("group:artifact:version") or implementation("group:artifact")
  const depRegex =
    /\b(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly|testCompileOnly|annotationProcessor|ksp)\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = depRegex.exec(raw)) !== null) {
    const parts = m[1].trim().split(":");
    if (parts.length < 2) continue;
    const group = parts[0].trim();
    const artifact = parts[1].trim();
    const version = parts[2]?.trim() ?? "";
    if (!group || !artifact) continue;

    if (version) {
      const coord = `${group}:${artifact}`;
      deps.set(coord, { coord, group, artifact, version, direct: true, sourceFile });
    } else {
      bomManagedCoords.push({ group, artifact });
    }
  }

  // Assign BOM-managed Spring Boot version when spring-boot plugin is present
  if (springBootVersion) {
    for (const item of bomManagedCoords) {
      if (item.group === "org.springframework.boot") {
        const coord = `${item.group}:${item.artifact}`;
        if (!deps.has(coord)) {
          deps.set(coord, {
            coord,
            group: item.group,
            artifact: item.artifact,
            version: springBootVersion,
            direct: true,
            sourceFile,
          });
        }
      }
    }
  }

  return deps;
}

/**
 * Diffs base and head Gradle dependency maps into canonical DependencyDelta[].
 */
export function diffGradleDeps(
  baseDeps: Map<string, ParsedGradleDep>,
  headDeps: Map<string, ParsedGradleDep>,
): DependencyDelta[] {
  const allCoords = new Set([...baseDeps.keys(), ...headDeps.keys()]);
  const deltas: DependencyDelta[] = [];

  for (const coord of Array.from(allCoords).sort()) {
    const base = baseDeps.get(coord);
    const head = headDeps.get(coord);
    const fromVersion = base?.version ?? null;
    const toVersion = head?.version ?? null;
    const bumpKind = classifyVersionBump(fromVersion, toVersion);
    if (bumpKind === "unchanged") continue;

    const group = head?.group ?? base?.group ?? coord.split(":")[0];
    const artifact = head?.artifact ?? base?.artifact ?? coord.split(":")[1];
    const sourceFile = head?.sourceFile ?? base?.sourceFile ?? "build.gradle.kts";
    const direct = head?.direct ?? base?.direct ?? true;

    deltas.push({
      id: `gradle:${coord}`,
      ecosystem: "gradle",
      category: "java",
      name: coord,
      group,
      artifact,
      fromVersion,
      toVersion,
      bumpKind,
      direct,
      sourceFile,
      inferredPackages: inferJavaPackages(coord),
    });
  }

  return deltas;
}
