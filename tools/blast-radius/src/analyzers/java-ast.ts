import * as path from "node:path";
import { parse, type CstNode, type IToken } from "java-parser";
import {
  isJacksonCoordinate,
  isSpringWebOrBootCoordinate,
  javaImportMatchesPackage,
} from "../mappings/package-map.js";
import type {
  AffectedFileSummary,
  AstSymbolKind,
  AstSymbolTouchpoint,
  CriticalPathTag,
  DependencyDelta,
  DtoContractTouchpoint,
  PackageMappingEdge,
} from "../types.js";
import { findRepoFiles, readFileSafe } from "../utils/fs-helpers.js";
import { toPosixPath } from "../utils/git.js";

interface JavaImportInfo {
  fqn: string;
  simpleName: string;
  wildcard: boolean;
  isStatic: boolean;
  line: number;
}

interface JavaAnnotationInfo {
  name: string;
  line: number;
}

interface JavaTypeInfo {
  name: string;
  kind: "class" | "record" | "interface";
  line: number;
  endLine: number;
  annotations: JavaAnnotationInfo[];
}

interface JavaMethodInfo {
  name: string;
  line: number;
  endLine: number;
  returnType: string;
  annotations: JavaAnnotationInfo[];
}

interface JavaTypeRefInfo {
  name: string;
  line: number;
}

interface ParsedJavaFile {
  filePath: string;
  project: string;
  packageName: string;
  lines: string[];
  imports: JavaImportInfo[];
  annotations: JavaAnnotationInfo[];
  types: JavaTypeInfo[];
  methods: JavaMethodInfo[];
  typeRefs: JavaTypeRefInfo[];
}

const CRITICAL_ANNOTATION_TAGS: Readonly<Record<string, CriticalPathTag>> = {
  RestController: "@RestController",
  Controller: "@Controller",
  Service: "@Service",
  Repository: "@Repository",
  Transactional: "@Transactional",
  SecurityFilterChain: "@SecurityFilterChain",
  Configuration: "@Configuration",
  Bean: "@Bean",
  SpringBootApplication: "@SpringBootApplication",
  ExceptionHandler: "@ExceptionHandler",
};

function isCstNode(el: unknown): el is CstNode {
  return Boolean(
    el &&
      typeof el === "object" &&
      "name" in el &&
      "children" in el &&
      typeof (el as CstNode).name === "string",
  );
}

function isToken(el: unknown): el is IToken {
  return Boolean(
    el &&
      typeof el === "object" &&
      "image" in el &&
      typeof (el as IToken).image === "string",
  );
}

function collectTokens(node: unknown, out: IToken[] = []): IToken[] {
  if (!node || typeof node !== "object") return out;
  if (isToken(node)) {
    out.push(node);
    return out;
  }
  if (isCstNode(node)) {
    for (const key of Object.keys(node.children)) {
      const list = node.children[key];
      if (!Array.isArray(list)) continue;
      for (const child of list) {
        collectTokens(child, out);
      }
    }
  }
  return out;
}

function tokensText(node: unknown): string {
  return collectTokens(node)
    .map((t) => t.image)
    .join(" ")
    .trim();
}

function extractAnnotationsFromModifiers(modifiers: unknown): JavaAnnotationInfo[] {
  const result: JavaAnnotationInfo[] = [];
  if (!Array.isArray(modifiers)) return result;

  function scanForAnnotation(node: unknown): void {
    if (!isCstNode(node)) return;
    if (node.name === "annotation") {
      const atTok = node.children.At?.[0] as IToken | undefined;
      const typeNameNode = node.children.typeName?.[0];
      const ids = collectTokens(typeNameNode)
        .filter((t) => t.image !== ".")
        .map((t) => t.image);
      const rawName = ids.join(".");
      const simple = ids[ids.length - 1] ?? rawName;
      if (simple) {
        result.push({
          name: simple,
          line: atTok?.startLine ?? node.location?.startLine ?? 1,
        });
      }
      return;
    }
    for (const key of Object.keys(node.children)) {
      const list = node.children[key];
      if (!Array.isArray(list)) continue;
      for (const child of list) {
        if (isCstNode(child)) scanForAnnotation(child);
      }
    }
  }

  for (const mod of modifiers) {
    scanForAnnotation(mod);
  }
  return result;
}

function inferJavaProject(relPosixPath: string): string {
  const idx = relPosixPath.indexOf("/src/");
  if (idx !== -1) {
    return relPosixPath.slice(0, idx);
  }
  const dir = path.posix.dirname(relPosixPath);
  return dir === "." ? "java" : dir;
}

function isDtoNameOrPath(name: string, filePath: string): boolean {
  return (
    /(?:Dto|Dtos|Request|Response)$/i.test(name) ||
    /(?:Dto|Dtos|Request|Response)\.java$/i.test(filePath)
  );
}

function parseJavaFileContent(
  filePath: string,
  content: string,
  warnings: string[],
): ParsedJavaFile | null {
  let cst: CstNode;
  try {
    cst = parse(content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Failed to parse Java file ${filePath}: ${msg}`);
    return null;
  }

  const lines = content.split(/\r?\n/);
  let packageName = "";
  const imports: JavaImportInfo[] = [];
  const annotations: JavaAnnotationInfo[] = [];
  const types: JavaTypeInfo[] = [];
  const methods: JavaMethodInfo[] = [];
  const typeRefs: JavaTypeRefInfo[] = [];

  function walk(node: CstNode): void {
    if (node.name === "packageDeclaration") {
      const ids = (node.children.Identifier ?? []) as IToken[];
      packageName = ids.map((t) => t.image).join(".");
      return;
    }

    if (node.name === "importDeclaration") {
      const impTok = node.children.Import?.[0] as IToken | undefined;
      const pkgOrType = node.children.packageOrTypeName?.[0];
      const ids = collectTokens(pkgOrType)
        .filter((t) => t.image !== ".")
        .map((t) => t.image);
      const fqn = ids.join(".");
      if (fqn) {
        imports.push({
          fqn,
          simpleName: ids[ids.length - 1] ?? fqn,
          wildcard: Boolean(node.children.Star?.length),
          isStatic: Boolean(node.children.Static?.length),
          line: impTok?.startLine ?? node.location?.startLine ?? 1,
        });
      }
      return;
    }

    if (node.name === "annotation") {
      const atTok = node.children.At?.[0] as IToken | undefined;
      const typeNameNode = node.children.typeName?.[0];
      const ids = collectTokens(typeNameNode)
        .filter((t) => t.image !== ".")
        .map((t) => t.image);
      const simple = ids[ids.length - 1] ?? "";
      if (simple) {
        const line = atTok?.startLine ?? node.location?.startLine ?? 1;
        annotations.push({ name: simple, line });
        typeRefs.push({ name: simple, line });
      }
    }

    if (node.name === "classDeclaration") {
      const mods = extractAnnotationsFromModifiers(node.children.classModifier);
      const normal = node.children.normalClassDeclaration?.[0] as CstNode | undefined;
      const rec = node.children.recordDeclaration?.[0] as CstNode | undefined;
      if (normal) {
        const idTok = (
          (normal.children.typeIdentifier?.[0] as CstNode | undefined)?.children
            ?.Identifier?.[0] as IToken | undefined
        );
        if (idTok) {
          types.push({
            name: idTok.image,
            kind: "class",
            line: idTok.startLine,
            endLine: normal.location?.endLine ?? idTok.startLine,
            annotations: mods,
          });
        }
      } else if (rec) {
        const idTok = (
          (rec.children.typeIdentifier?.[0] as CstNode | undefined)?.children
            ?.Identifier?.[0] as IToken | undefined
        );
        if (idTok) {
          types.push({
            name: idTok.image,
            kind: "record",
            line: idTok.startLine,
            endLine: rec.location?.endLine ?? idTok.startLine,
            annotations: mods,
          });
        }
      }
    }

    if (node.name === "interfaceDeclaration") {
      const mods = extractAnnotationsFromModifiers(node.children.interfaceModifier);
      const normal = node.children.normalInterfaceDeclaration?.[0] as
        | CstNode
        | undefined;
      if (normal) {
        const idTok = (
          (normal.children.typeIdentifier?.[0] as CstNode | undefined)?.children
            ?.Identifier?.[0] as IToken | undefined
        );
        if (idTok) {
          types.push({
            name: idTok.image,
            kind: "interface",
            line: idTok.startLine,
            endLine: normal.location?.endLine ?? idTok.startLine,
            annotations: mods,
          });
        }
      }
    }

    if (node.name === "methodDeclaration") {
      const mods = extractAnnotationsFromModifiers(node.children.methodModifier);
      const header = node.children.methodHeader?.[0] as CstNode | undefined;
      if (header) {
        const resultText = tokensText(header.children.result?.[0]);
        const declarator = header.children.methodDeclarator?.[0] as
          | CstNode
          | undefined;
        const idTok = declarator?.children?.Identifier?.[0] as
          | IToken
          | undefined;
        if (idTok) {
          // java-parser parses nested `public record Foo(...) {}` inside a class body
          // as a methodDeclaration whose result token is literally `record`.
          if (resultText === "record") {
            types.push({
              name: idTok.image,
              kind: "record",
              line: idTok.startLine,
              endLine: node.location?.endLine ?? idTok.startLine,
              annotations: mods,
            });
          } else {
            methods.push({
              name: idTok.image,
              line: idTok.startLine,
              endLine: node.location?.endLine ?? idTok.startLine,
              returnType: resultText,
              annotations: mods,
            });
          }
        }
      }
    }

    if (
      node.name === "unannClassType" ||
      node.name === "classOrInterfaceTypeToInstantiate"
    ) {
      const toks = collectTokens(node).filter(
        (t) => /^[A-Z][A-Za-z0-9_]*$/.test(t.image),
      );
      for (const tok of toks) {
        typeRefs.push({ name: tok.image, line: tok.startLine });
      }
    }

    for (const key of Object.keys(node.children)) {
      const list = node.children[key];
      if (!Array.isArray(list)) continue;
      for (const child of list) {
        if (isCstNode(child)) {
          walk(child);
        }
      }
    }
  }

  walk(cst);

  return {
    filePath,
    project: inferJavaProject(filePath),
    packageName,
    lines,
    imports,
    annotations,
    types,
    methods,
    typeRefs,
  };
}

function getSnippet(lines: string[], line: number): string {
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) return "";
  return lines[idx].trim().slice(0, 160);
}

function collectCriticalTagsForFile(file: ParsedJavaFile): CriticalPathTag[] {
  const tags = new Set<CriticalPathTag>();

  for (const ann of file.annotations) {
    const mapped = CRITICAL_ANNOTATION_TAGS[ann.name];
    if (mapped) tags.add(mapped);
  }
  for (const method of file.methods) {
    if (
      method.returnType.includes("SecurityFilterChain") ||
      method.name.toLowerCase().includes("securityfilterchain")
    ) {
      tags.add("@SecurityFilterChain");
    }
  }
  const hasRecordsInDtoContext =
    file.types.some((t) => t.kind === "record" && isDtoNameOrPath(t.name, file.filePath)) ||
    (isDtoNameOrPath(path.posix.basename(file.filePath), file.filePath) &&
      file.types.some((t) => t.kind === "record" || t.kind === "class"));
  if (hasRecordsInDtoContext) {
    tags.add("DTO");
  }

  return Array.from(tags);
}

export interface JavaAstAnalysisResult {
  affectedFiles: AffectedFileSummary[];
  packageMappings: PackageMappingEdge[];
  dtoContracts: DtoContractTouchpoint[];
}

/**
 * Analyzes Java source files against changed Gradle/Maven dependencies using java-parser CST.
 */
export function analyzeJavaBlastRadius(
  repoRoot: string,
  javaDependencies: DependencyDelta[],
  warnings: string[],
): JavaAstAnalysisResult {
  if (javaDependencies.length === 0) {
    return { affectedFiles: [], packageMappings: [], dtoContracts: [] };
  }

  let javaFiles = findRepoFiles(
    repoRoot,
    (rel) => rel.endsWith(".java") && rel.includes("/src/main/java/"),
  );
  if (javaFiles.length === 0) {
    javaFiles = findRepoFiles(
      repoRoot,
      (rel) =>
        rel.endsWith(".java") &&
        !rel.includes("/src/test/") &&
        !rel.endsWith("Test.java"),
    );
  }

  if (javaFiles.length === 0) {
    return { affectedFiles: [], packageMappings: [], dtoContracts: [] };
  }

  const parsedFiles: ParsedJavaFile[] = [];
  for (const relPath of javaFiles) {
    const content = readFileSafe(path.join(repoRoot, relPath));
    if (content === null) continue;
    const parsed = parseJavaFileContent(relPath, content, warnings);
    if (parsed) parsedFiles.push(parsed);
  }

  const fileTouchpoints = new Map<string, AstSymbolTouchpoint[]>();
  const fileMatchedDeps = new Map<string, Set<string>>();
  const fileMatchedPkgs = new Map<string, Set<string>>();
  const pkgMappingIndex = new Map<string, PackageMappingEdge>();
  const dtoContracts: DtoContractTouchpoint[] = [];
  const dtoContractKeys = new Set<string>();

  const ensureFileEntry = (filePath: string): void => {
    if (!fileTouchpoints.has(filePath)) fileTouchpoints.set(filePath, []);
    if (!fileMatchedDeps.has(filePath)) fileMatchedDeps.set(filePath, new Set());
    if (!fileMatchedPkgs.has(filePath)) fileMatchedPkgs.set(filePath, new Set());
  };

  const addTouchpoint = (
    file: ParsedJavaFile,
    tp: Omit<AstSymbolTouchpoint, "id">,
  ): void => {
    ensureFileEntry(file.filePath);
    const list = fileTouchpoints.get(file.filePath)!;
    const id = `${file.filePath}:${tp.line}:${tp.kind}:${tp.symbolName}`;
    const existing = list.find((item) => item.id === id);
    if (existing) {
      for (const depId of tp.matchedDependencyIds) {
        if (!existing.matchedDependencyIds.includes(depId)) {
          existing.matchedDependencyIds.push(depId);
        }
      }
      for (const tag of tp.criticalPathTags) {
        if (!existing.criticalPathTags.includes(tag)) {
          existing.criticalPathTags.push(tag);
        }
      }
      existing.isCriticalPath = existing.criticalPathTags.length > 0;
      return;
    }

    list.push({ id, ...tp });
    for (const depId of tp.matchedDependencyIds) {
      fileMatchedDeps.get(file.filePath)!.add(depId);
    }
    fileMatchedPkgs.get(file.filePath)!.add(tp.matchedImport);
  };

  const recordPackageMapping = (
    dep: DependencyDelta,
    pkgName: string,
    filePath: string,
    countIncrement = 1,
  ): void => {
    const key = `${dep.id}::${pkgName}`;
    let edge = pkgMappingIndex.get(key);
    if (!edge) {
      edge = {
        id: key,
        dependencyId: dep.id,
        dependencyName: dep.name,
        ecosystem: dep.ecosystem,
        category: "java",
        packageName: pkgName,
        filePaths: [],
        touchpointCount: 0,
      };
      pkgMappingIndex.set(key, edge);
    }
    if (!edge.filePaths.includes(filePath)) {
      edge.filePaths.push(filePath);
    }
    edge.touchpointCount += countIncrement;
  };

  const jacksonDeps = javaDependencies.filter((d) => isJacksonCoordinate(d.name));
  const springWebBootDeps = javaDependencies.filter((d) =>
    isSpringWebOrBootCoordinate(d.name),
  );

  const parsedByFqn = new Map<string, ParsedJavaFile>();
  for (const file of parsedFiles) {
    for (const t of file.types) {
      const fqn = file.packageName ? `${file.packageName}.${t.name}` : t.name;
      parsedByFqn.set(fqn, file);
    }
  }

  for (const file of parsedFiles) {
    const fileTags = collectCriticalTagsForFile(file);
    const matchedSimpleNames = new Map<string, { depIds: string[]; importFqn: string }>();

    for (const imp of file.imports) {
      const matchingDeps: DependencyDelta[] = [];
      const matchingPkgPrefixes: string[] = [];

      for (const dep of javaDependencies) {
        for (const prefix of dep.inferredPackages) {
          if (javaImportMatchesPackage(imp.fqn, prefix)) {
            matchingDeps.push(dep);
            matchingPkgPrefixes.push(prefix);
          }
        }
      }

      if (matchingDeps.length === 0) continue;

      const depIds = Array.from(new Set(matchingDeps.map((d) => d.id)));
      const importTag = CRITICAL_ANNOTATION_TAGS[imp.simpleName]
        ? [CRITICAL_ANNOTATION_TAGS[imp.simpleName]]
        : [];
      const tagsForImport: CriticalPathTag[] = Array.from(
        new Set([...importTag, ...fileTags]),
      );

      addTouchpoint(file, {
        language: "java",
        ecosystem: "java",
        filePath: file.filePath,
        line: imp.line,
        kind: "import",
        symbolName: imp.simpleName,
        matchedImport: imp.fqn,
        matchedDependencyIds: depIds,
        criticalPathTags: tagsForImport,
        isCriticalPath: tagsForImport.length > 0,
        snippet: getSnippet(file.lines, imp.line),
      });

      if (!imp.wildcard) {
        matchedSimpleNames.set(imp.simpleName, {
          depIds,
          importFqn: imp.fqn,
        });
      }

      for (let i = 0; i < matchingDeps.length; i++) {
        recordPackageMapping(
          matchingDeps[i],
          matchingPkgPrefixes[i],
          file.filePath,
          1,
        );
      }
    }

    // Jackson transitive serialization impact on @RestController / @Controller / DTO records
    if (
      jacksonDeps.length > 0 &&
      (fileTags.includes("@RestController") ||
        fileTags.includes("@Controller") ||
        fileTags.includes("DTO"))
    ) {
      const jacksonIds = jacksonDeps.map((d) => d.id);
      const primaryLine = file.types[0]?.line ?? 1;
      const primarySym = file.types[0]?.name ?? path.posix.basename(file.filePath);
      addTouchpoint(file, {
        language: "java",
        ecosystem: "java",
        filePath: file.filePath,
        line: primaryLine,
        kind: fileTags.includes("DTO") ? "record" : "annotation",
        symbolName: primarySym,
        matchedImport: "jackson (REST/DTO serialization)",
        matchedDependencyIds: jacksonIds,
        criticalPathTags: fileTags,
        isCriticalPath: true,
        snippet: getSnippet(file.lines, primaryLine),
      });
      for (const jd of jacksonDeps) {
        recordPackageMapping(
          jd,
          "com.fasterxml.jackson (REST/DTO)",
          file.filePath,
          1,
        );
      }
    }

    if (!fileMatchedDeps.has(file.filePath)) continue;

    const fileDepIds = Array.from(fileMatchedDeps.get(file.filePath)!);

    // Record critical-path annotations, types, methods, and type references inside matched files
    for (const ann of file.annotations) {
      const tag = CRITICAL_ANNOTATION_TAGS[ann.name];
      const imported = matchedSimpleNames.get(ann.name);
      if (tag || imported) {
        addTouchpoint(file, {
          language: "java",
          ecosystem: "java",
          filePath: file.filePath,
          line: ann.line,
          kind: "annotation",
          symbolName: `@${ann.name}`,
          matchedImport: imported?.importFqn ?? fileTags[0] ?? `@${ann.name}`,
          matchedDependencyIds: imported?.depIds ?? fileDepIds,
          criticalPathTags: tag ? [tag] : fileTags,
          isCriticalPath: Boolean(tag) || fileTags.length > 0,
          snippet: getSnippet(file.lines, ann.line),
        });
      }
    }

    for (const typeInfo of file.types) {
      const typeTags = Array.from(
        new Set([
          ...typeInfo.annotations
            .map((a) => CRITICAL_ANNOTATION_TAGS[a.name])
            .filter((t): t is CriticalPathTag => Boolean(t)),
          ...(isDtoNameOrPath(typeInfo.name, file.filePath) ? (["DTO"] as CriticalPathTag[]) : []),
        ]),
      );
      if (typeTags.length > 0 || fileTags.length > 0) {
        const mergedTags = typeTags.length > 0 ? typeTags : fileTags;
        addTouchpoint(file, {
          language: "java",
          ecosystem: "java",
          filePath: file.filePath,
          line: typeInfo.line,
          endLine: typeInfo.endLine,
          kind: typeInfo.kind,
          symbolName: typeInfo.name,
          matchedImport: Array.from(fileMatchedPkgs.get(file.filePath)!)[0] ?? typeInfo.name,
          matchedDependencyIds: fileDepIds,
          criticalPathTags: mergedTags,
          isCriticalPath: mergedTags.length > 0,
          snippet: getSnippet(file.lines, typeInfo.line),
        });
      }
    }

    for (const method of file.methods) {
      const methodTags = method.annotations
        .map((a) => CRITICAL_ANNOTATION_TAGS[a.name])
        .filter((t): t is CriticalPathTag => Boolean(t));
      if (
        method.returnType.includes("SecurityFilterChain") ||
        method.name.toLowerCase().includes("securityfilterchain")
      ) {
        methodTags.push("@SecurityFilterChain");
      }
      const isControllerMapping = method.annotations.some((a) =>
        /(?:Get|Post|Put|Delete|Patch|Request)Mapping$/.test(a.name),
      );
      if (methodTags.length > 0 || isControllerMapping) {
        const merged = Array.from(
          new Set(methodTags.length > 0 ? methodTags : fileTags),
        );
        addTouchpoint(file, {
          language: "java",
          ecosystem: "java",
          filePath: file.filePath,
          line: method.line,
          endLine: method.endLine,
          kind: "method" satisfies AstSymbolKind,
          symbolName: method.name,
          matchedImport: Array.from(fileMatchedPkgs.get(file.filePath)!)[0] ?? method.name,
          matchedDependencyIds: fileDepIds,
          criticalPathTags: merged,
          isCriticalPath: merged.length > 0,
          snippet: getSnippet(file.lines, method.line),
        });
      }
    }

    for (const ref of file.typeRefs) {
      const imported = matchedSimpleNames.get(ref.name);
      if (imported) {
        addTouchpoint(file, {
          language: "java",
          ecosystem: "java",
          filePath: file.filePath,
          line: ref.line,
          kind: "type_reference",
          symbolName: ref.name,
          matchedImport: imported.importFqn,
          matchedDependencyIds: imported.depIds,
          criticalPathTags: fileTags,
          isCriticalPath: fileTags.length > 0,
          snippet: getSnippet(file.lines, ref.line),
        });
      }
    }
  }

  // 1-hop DTO / Contract propagation from affected controllers/services to internal DTO files
  for (const file of parsedFiles) {
    const depIds = fileMatchedDeps.get(file.filePath);
    if (!depIds || depIds.size === 0) continue;

    for (const imp of file.imports) {
      // Check direct class import or nested DTO import like com.pulse.backend.api.PulseDtos.TriageRequest
      const segments = imp.fqn.split(".");
      for (let len = segments.length; len >= 2; len--) {
        const candidateFqn = segments.slice(0, len).join(".");
        const targetFile = parsedByFqn.get(candidateFqn);
        if (!targetFile || targetFile.filePath === file.filePath) continue;
        const targetTags = collectCriticalTagsForFile(targetFile);
        if (!targetTags.includes("DTO")) continue;

        const propagatedDepIds = Array.from(depIds);
        for (const typeInfo of targetFile.types) {
          if (typeInfo.kind !== "record" && !isDtoNameOrPath(typeInfo.name, targetFile.filePath)) {
            continue;
          }
          addTouchpoint(targetFile, {
            language: "java",
            ecosystem: "java",
            filePath: targetFile.filePath,
            line: typeInfo.line,
            endLine: typeInfo.endLine,
            kind: typeInfo.kind,
            symbolName: typeInfo.name,
            matchedImport: `${file.filePath} -> ${candidateFqn}`,
            matchedDependencyIds: propagatedDepIds,
            criticalPathTags: ["DTO"],
            isCriticalPath: true,
            snippet: getSnippet(targetFile.lines, typeInfo.line),
          });
        }
        break;
      }
    }
  }

  // Build DTO contracts list & AffectedFileSummary[]
  const affectedFiles: AffectedFileSummary[] = [];

  for (const file of parsedFiles) {
    const tps = fileTouchpoints.get(file.filePath);
    if (!tps || tps.length === 0) continue;

    const depIds = Array.from(fileMatchedDeps.get(file.filePath) ?? []).sort();
    const pkgs = Array.from(fileMatchedPkgs.get(file.filePath) ?? []).sort();
    const fileTags = Array.from(
      new Set([
        ...collectCriticalTagsForFile(file),
        ...tps.flatMap((t) => t.criticalPathTags),
      ]),
    );
    const isDto = fileTags.includes("DTO");
    const isCritical = fileTags.length > 0;
    const symbols = Array.from(new Set(tps.map((t) => t.symbolName)));

    if (isDto) {
      for (const t of file.types) {
        if (t.kind === "record" || isDtoNameOrPath(t.name, file.filePath)) {
          const key = `${file.filePath}:${t.line}:${t.name}`;
          if (!dtoContractKeys.has(key)) {
            dtoContractKeys.add(key);
            dtoContracts.push({
              filePath: file.filePath,
              line: t.line,
              symbolName: t.name,
              language: "java",
              kind: t.kind,
              matchedDependencyIds: depIds,
              reason:
                springWebBootDeps.length > 0 || jacksonDeps.length > 0
                  ? "REST / JSON contract DTO referenced by affected Spring Web endpoint"
                  : "DTO / validation contract touched by dependency update",
            });
          }
        }
      }
    }

    const sortedTouchpoints = [...tps].sort((a, b) => a.line - b.line);
    const tagBonus =
      (fileTags.includes("@SecurityFilterChain") ? 20 : 0) +
      (fileTags.includes("@Transactional") ? 15 : 0) +
      (fileTags.includes("@RestController") || fileTags.includes("@Controller") ? 12 : 0) +
      (fileTags.includes("@Service") || fileTags.includes("@Repository") ? 10 : 0) +
      (isDto ? 10 : 0);

    affectedFiles.push({
      filePath: file.filePath,
      language: "java",
      ecosystem: "java",
      project: file.project,
      isCriticalPath: isCritical,
      isDtoOrContract: isDto,
      criticalPathTags: fileTags,
      matchedDependencyIds: depIds,
      matchedPackages: pkgs,
      touchpointCount: sortedTouchpoints.length,
      touchpoints: sortedTouchpoints,
      symbols,
      riskWeight: Math.min(100, 10 + tagBonus + sortedTouchpoints.length * 2),
    });
  }

  affectedFiles.sort((a, b) => a.filePath.localeCompare(b.filePath));
  const packageMappings = Array.from(pkgMappingIndex.values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  dtoContracts.sort((a, b) =>
    a.filePath === b.filePath ? a.line - b.line : a.filePath.localeCompare(b.filePath),
  );

  return { affectedFiles, packageMappings, dtoContracts };
}
