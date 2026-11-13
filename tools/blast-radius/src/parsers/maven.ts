import { inferJavaPackages } from "../mappings/package-map.js";
import type { DependencyDelta } from "../types.js";
import { safeJsonParse } from "../utils/fs-helpers.js";
import { classifyVersionBump } from "../utils/semver.js";

export interface ParsedMavenDep {
  coord: string;
  group: string;
  artifact: string;
  version: string;
  direct: boolean;
  sourceFile: string;
}

interface MavenTreeNode {
  groupId?: unknown;
  artifactId?: unknown;
  version?: unknown;
  children?: unknown;
  dependencies?: unknown;
}

/**
 * Parses `mvn dependency:tree -DoutputType=json` output cleanly.
 */
export function parseMavenTreeJson(
  raw: string,
  sourceFile: string,
  warnings: string[],
): Map<string, ParsedMavenDep> {
  const deps = new Map<string, ParsedMavenDep>();
  if (!raw.trim()) return deps;

  const parsed = safeJsonParse<unknown>(raw, sourceFile, warnings);
  if (!parsed || typeof parsed !== "object") {
    return deps;
  }

  function visitNode(node: MavenTreeNode, depth: number): void {
    const group = typeof node.groupId === "string" ? node.groupId.trim() : "";
    const artifact =
      typeof node.artifactId === "string" ? node.artifactId.trim() : "";
    const version =
      typeof node.version === "string" ? node.version.trim() : "";

    // depth === 0 is the root project itself; depth === 1 is a direct dependency
    if (depth >= 1 && group && artifact && version) {
      const coord = `${group}:${artifact}`;
      const direct = depth === 1;
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

    const childList = Array.isArray(node.children)
      ? node.children
      : Array.isArray(node.dependencies)
        ? node.dependencies
        : [];
    for (const child of childList) {
      if (child && typeof child === "object") {
        visitNode(child as MavenTreeNode, depth + 1);
      }
    }
  }

  if (Array.isArray(parsed)) {
    for (const root of parsed) {
      if (root && typeof root === "object") {
        visitNode(root as MavenTreeNode, 0);
      }
    }
  } else {
    visitNode(parsed as MavenTreeNode, 0);
  }

  return deps;
}

function stripXmlComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, "");
}

function validateSimpleXmlBalance(
  xml: string,
  sourceFile: string,
  warnings: string[],
): boolean {
  const cleaned = stripXmlComments(xml)
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .trim();

  if (!cleaned.includes("<project")) {
    warnings.push(`Malformed XML in ${sourceFile}: missing <project> root element.`);
    return false;
  }

  // Basic tag stack verification for well-formedness
  const stack: string[] = [];
  const tagRegex = /<\/?([A-Za-z_][A-Za-z0-9_.:-]*)(?:\s[^>]*)?(\/?)>/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = tagRegex.exec(cleaned)) !== null) {
    const gap = cleaned.slice(lastIndex, match.index);
    if (gap.includes("<")) {
      warnings.push(`Malformed XML in ${sourceFile}: unclosed '<' token.`);
      return false;
    }
    lastIndex = tagRegex.lastIndex;

    const full = match[0];
    const tagName = match[1];
    const isClosing = full.startsWith("</");
    const isSelfClosing = match[2] === "/";

    if (isSelfClosing) continue;
    if (isClosing) {
      const top = stack.pop();
      if (top !== tagName) {
        warnings.push(
          `Malformed XML in ${sourceFile}: mismatched closing tag </${tagName}> (expected </${top ?? "EOF"}>).`,
        );
        return false;
      }
    } else {
      stack.push(tagName);
    }
  }

  if (stack.length > 0) {
    warnings.push(
      `Malformed XML in ${sourceFile}: unclosed XML tag(s) ${stack.map((t) => `<${t}>`).join(", ")}.`,
    );
    return false;
  }

  return true;
}

function extractXmlTag(block: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>\\s*([^<]*?)\\s*</${tagName}>`, "s");
  const m = regex.exec(block);
  return m ? m[1].trim() : null;
}

function resolvePomProperties(
  value: string,
  props: Map<string, string>,
): string {
  return value.replace(/\$\{([^}]+)\}/g, (full, key: string) => {
    const resolved = props.get(key.trim());
    return resolved ?? full;
  });
}

/**
 * Parses a Maven `pom.xml` file for `<parent>`, `<properties>`, `<dependencyManagement>`, and `<dependencies>`.
 */
export function parsePomXml(
  raw: string,
  sourceFile: string,
  warnings: string[],
): Map<string, ParsedMavenDep> {
  const deps = new Map<string, ParsedMavenDep>();
  if (!raw.trim()) return deps;

  if (!validateSimpleXmlBalance(raw, sourceFile, warnings)) {
    return deps;
  }

  const cleaned = stripXmlComments(raw);
  const props = new Map<string, string>();

  // Extract <properties>
  const propsBlockMatch = /<properties>([\s\S]*?)<\/properties>/.exec(cleaned);
  if (propsBlockMatch) {
    const propTagRegex = /<([A-Za-z0-9_.-]+)>\s*([^<]*?)\s*<\/\1>/g;
    let pm: RegExpExecArray | null;
    while ((pm = propTagRegex.exec(propsBlockMatch[1])) !== null) {
      props.set(pm[1].trim(), pm[2].trim());
    }
  }

  // Extract <parent>
  const parentMatch = /<parent>([\s\S]*?)<\/parent>/.exec(cleaned);
  let parentVersion: string | null = null;
  if (parentMatch) {
    const g = extractXmlTag(parentMatch[1], "groupId");
    const a = extractXmlTag(parentMatch[1], "artifactId");
    const v = extractXmlTag(parentMatch[1], "version");
    if (g && a && v) {
      const resolvedV = resolvePomProperties(v, props);
      parentVersion = resolvedV;
      const coord = `${g}:${a}`;
      deps.set(coord, {
        coord,
        group: g,
        artifact: a,
        version: resolvedV,
        direct: true,
        sourceFile,
      });
    }
  }

  // Extract managed versions from <dependencyManagement>
  const managedVersions = new Map<string, string>();
  const dmMatch = /<dependencyManagement>([\s\S]*?)<\/dependencyManagement>/.exec(
    cleaned,
  );
  if (dmMatch) {
    const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
    let dm: RegExpExecArray | null;
    while ((dm = depRegex.exec(dmMatch[1])) !== null) {
      const g = extractXmlTag(dm[1], "groupId");
      const a = extractXmlTag(dm[1], "artifactId");
      const v = extractXmlTag(dm[1], "version");
      if (g && a && v) {
        managedVersions.set(`${g}:${a}`, resolvePomProperties(v, props));
      }
    }
  }

  // Strip <dependencyManagement> before extracting top-level <dependencies>
  const withoutDm = cleaned.replace(
    /<dependencyManagement>[\s\S]*?<\/dependencyManagement>/g,
    "",
  );
  const depsBlockRegex = /<dependencies>([\s\S]*?)<\/dependencies>/g;
  let dbm: RegExpExecArray | null;
  while ((dbm = depsBlockRegex.exec(withoutDm)) !== null) {
    const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
    let dm: RegExpExecArray | null;
    while ((dm = depRegex.exec(dbm[1])) !== null) {
      const g = extractXmlTag(dm[1], "groupId");
      const a = extractXmlTag(dm[1], "artifactId");
      const rawV = extractXmlTag(dm[1], "version");
      if (!g || !a) continue;
      const coord = `${g}:${a}`;
      const version = rawV
        ? resolvePomProperties(rawV, props)
        : managedVersions.get(coord) ??
          (g === "org.springframework.boot" && parentVersion
            ? parentVersion
            : "");

      if (!version) continue;
      deps.set(coord, {
        coord,
        group: g,
        artifact: a,
        version,
        direct: true,
        sourceFile,
      });
    }
  }

  return deps;
}

export function diffMavenDeps(
  baseDeps: Map<string, ParsedMavenDep>,
  headDeps: Map<string, ParsedMavenDep>,
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
    const sourceFile = head?.sourceFile ?? base?.sourceFile ?? "pom.xml";
    const direct = head?.direct ?? base?.direct ?? true;

    deltas.push({
      id: `maven:${coord}`,
      ecosystem: "maven",
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
