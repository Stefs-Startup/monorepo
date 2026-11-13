import * as fs from "node:fs";
import * as path from "node:path";
import { Project, SyntaxKind, type SourceFile } from "ts-morph";
import { tsImportMatchesPackage } from "../mappings/package-map.js";
import type {
  AffectedFileSummary,
  AstSymbolTouchpoint,
  CriticalPathTag,
  DependencyDelta,
  DtoContractTouchpoint,
  PackageMappingEdge,
} from "../types.js";
import { findRepoFiles } from "../utils/fs-helpers.js";
import { toPosixPath } from "../utils/git.js";

const SIGNAL_FUNCTIONS = new Set([
  "signal",
  "computed",
  "effect",
  "toSignal",
  "toObservable",
  "input",
  "output",
  "model",
]);

const RXJS_CALL_NAMES = new Set([
  "pipe",
  "subscribe",
  "switchMap",
  "mergeMap",
  "concatMap",
  "exhaustMap",
  "map",
  "tap",
  "catchError",
  "filter",
  "combineLatest",
  "forkJoin",
  "of",
  "from",
]);

const ANGULAR_CRITICAL_DECORATORS: Readonly<Record<string, CriticalPathTag>> = {
  Component: "@Component",
  Injectable: "@Injectable",
};

function isTestFile(relPath: string): boolean {
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/i.test(relPath);
}

function isModelOrDtoFile(relPath: string): boolean {
  return /(?:^|\/)models\/|(?:dto|model|contract)s?\.ts$/i.test(relPath);
}

function isDtoInterfaceName(name: string): boolean {
  return /(?:Dto|Request|Response|Status|Snapshot|Model|Payload|Settings)$/i.test(
    name,
  );
}

function inferTsProjectDir(relPosixPath: string): string {
  const parts = relPosixPath.split("/");
  if (parts.length >= 3 && (parts[0] === "apps" || parts[0] === "packages" || parts[0] === "tools")) {
    if (parts[0] === "apps" && parts[1] === "pulse" && parts.length >= 4) {
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return `${parts[0]}/${parts[1]}`;
  }
  return path.posix.dirname(relPosixPath);
}

function lockfileScopePrefix(dep: DependencyDelta): string {
  const dir = path.posix.dirname(toPosixPath(dep.sourceFile));
  if (dir === "." || dir === "") return "";
  return `${dir}/`;
}

function getLineSnippet(lines: string[], line: number): string {
  const idx = line - 1;
  if (idx < 0 || idx >= lines.length) return "";
  return lines[idx].trim().slice(0, 160);
}

function discoverTsSourceFiles(
  repoRoot: string,
  warnings: string[],
): Map<string, SourceFile> {
  const tsconfigRelPaths = findRepoFiles(
    repoRoot,
    (rel, fileName) =>
      fileName === "tsconfig.json" &&
      !rel.startsWith("tools/blast-radius/") &&
      !rel.startsWith("tools/blast-radius-ui/"),
  );

  const sourceFilesByRel = new Map<string, SourceFile>();

  for (const relCfg of tsconfigRelPaths) {
    const absCfg = path.join(repoRoot, relCfg);
    try {
      const project = new Project({
        tsConfigFilePath: absCfg,
        skipFileDependencyResolution: true,
      });
      for (const sf of project.getSourceFiles()) {
        const rel = toPosixPath(path.relative(repoRoot, sf.getFilePath()));
        if (
          rel.startsWith("..") ||
          rel.includes("/node_modules/") ||
          rel.includes("/dist/") ||
          rel.startsWith("apps/backstage/") ||
          sf.isDeclarationFile()
        ) {
          continue;
        }
        if (!sourceFilesByRel.has(rel)) {
          sourceFilesByRel.set(rel, sf);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Skipping tsconfig ${relCfg}: ${msg}`);
    }
  }

  // Fallback for fixture repositories without tsconfig.json
  if (sourceFilesByRel.size === 0) {
    const tsFiles = findRepoFiles(
      repoRoot,
      (rel) =>
        (rel.endsWith(".ts") || rel.endsWith(".tsx")) &&
        !rel.endsWith(".d.ts") &&
        !rel.startsWith("tools/blast-radius/") &&
        !rel.startsWith("tools/blast-radius-ui/"),
    );
    if (tsFiles.length > 0) {
      const fallbackProject = new Project({
        useInMemoryFileSystem: false,
        skipFileDependencyResolution: true,
      });
      for (const rel of tsFiles) {
        const sf = fallbackProject.addSourceFileAtPath(path.join(repoRoot, rel));
        sourceFilesByRel.set(rel, sf);
      }
    }
  }

  return sourceFilesByRel;
}

export interface TsAstAnalysisResult {
  affectedFiles: AffectedFileSummary[];
  packageMappings: PackageMappingEdge[];
  dtoContracts: DtoContractTouchpoint[];
}

/**
 * Analyzes Angular / TypeScript source files with ts-morph against changed npm/pnpm dependencies.
 */
export function analyzeTypeScriptBlastRadius(
  repoRoot: string,
  tsDependencies: DependencyDelta[],
  warnings: string[],
): TsAstAnalysisResult {
  if (tsDependencies.length === 0) {
    return { affectedFiles: [], packageMappings: [], dtoContracts: [] };
  }

  const sourceFilesByRel = discoverTsSourceFiles(repoRoot, warnings);
  if (sourceFilesByRel.size === 0) {
    return { affectedFiles: [], packageMappings: [], dtoContracts: [] };
  }

  const fileTouchpoints = new Map<string, AstSymbolTouchpoint[]>();
  const fileMatchedDeps = new Map<string, Set<string>>();
  const fileMatchedPkgs = new Map<string, Set<string>>();
  const pkgMappingIndex = new Map<string, PackageMappingEdge>();
  const dtoContracts: DtoContractTouchpoint[] = [];
  const dtoContractKeys = new Set<string>();
  const fileLinesCache = new Map<string, string[]>();

  const getLines = (sf: SourceFile, relPath: string): string[] => {
    let cached = fileLinesCache.get(relPath);
    if (!cached) {
      cached = sf.getFullText().split(/\r?\n/);
      fileLinesCache.set(relPath, cached);
    }
    return cached;
  };

  const ensureFileEntry = (relPath: string): void => {
    if (!fileTouchpoints.has(relPath)) fileTouchpoints.set(relPath, []);
    if (!fileMatchedDeps.has(relPath)) fileMatchedDeps.set(relPath, new Set());
    if (!fileMatchedPkgs.has(relPath)) fileMatchedPkgs.set(relPath, new Set());
  };

  const addTouchpoint = (
    relPath: string,
    tp: Omit<AstSymbolTouchpoint, "id">,
  ): void => {
    ensureFileEntry(relPath);
    const list = fileTouchpoints.get(relPath)!;
    const id = `${relPath}:${tp.line}:${tp.kind}:${tp.symbolName}`;
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
      fileMatchedDeps.get(relPath)!.add(depId);
    }
    fileMatchedPkgs.get(relPath)!.add(tp.matchedImport);
  };

  const recordPackageMapping = (
    dep: DependencyDelta,
    pkgName: string,
    relPath: string,
  ): void => {
    const key = `${dep.id}::${pkgName}`;
    let edge = pkgMappingIndex.get(key);
    if (!edge) {
      edge = {
        id: key,
        dependencyId: dep.id,
        dependencyName: dep.name,
        ecosystem: dep.ecosystem,
        category: "typescript",
        packageName: pkgName,
        filePaths: [],
        touchpointCount: 0,
      };
      pkgMappingIndex.set(key, edge);
    }
    if (!edge.filePaths.includes(relPath)) {
      edge.filePaths.push(relPath);
    }
    edge.touchpointCount += 1;
  };

  for (const [relPath, sf] of Array.from(sourceFilesByRel.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const testFile = isTestFile(relPath);
    const lines = getLines(sf, relPath);

    // Filter dependencies whose lockfile scope covers this source file
    const fileProjectDir = inferTsProjectDir(relPath);
    const projectUsesOwnNpmLock = fs.existsSync(
      path.join(repoRoot, fileProjectDir, "package-lock.json"),
    );
    const applicableDeps = tsDependencies.filter((dep) => {
      if (
        dep.ecosystem === "pnpm" &&
        dep.sourceFile === "pnpm-lock.yaml" &&
        projectUsesOwnNpmLock
      ) {
        return false;
      }
      const scope = lockfileScopePrefix(dep);
      return !scope || relPath.startsWith(scope);
    });
    if (applicableDeps.length === 0) continue;

    // Collect decorators on classes in this file
    const classDecoratorTags = new Set<CriticalPathTag>();
    const decoratedClasses: Array<{
      name: string;
      line: number;
      endLine: number;
      decoratorName: string;
      tag?: CriticalPathTag;
    }> = [];

    for (const cls of sf.getClasses()) {
      const clsName = cls.getName() ?? "<anonymous>";
      for (const dec of cls.getDecorators()) {
        const decName = dec.getName();
        const tag = ANGULAR_CRITICAL_DECORATORS[decName];
        if (tag && !testFile) classDecoratorTags.add(tag);
        decoratedClasses.push({
          name: clsName,
          line: dec.getStartLineNumber(),
          endLine: cls.getEndLineNumber(),
          decoratorName: decName,
          tag,
        });
      }
    }

    // Collect Signal & RxJS usages inside this file
    const signalCalls: Array<{ name: string; line: number }> = [];
    const rxjsCalls: Array<{ name: string; line: number }> = [];

    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      let callName = "";
      if (expr.getKind() === SyntaxKind.Identifier) {
        callName = expr.getText();
      } else if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        callName = expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName() ?? "";
      }
      if (!callName) continue;
      const line = call.getStartLineNumber();
      if (SIGNAL_FUNCTIONS.has(callName)) {
        signalCalls.push({ name: callName, line });
      } else if (RXJS_CALL_NAMES.has(callName)) {
        rxjsCalls.push({ name: callName, line });
      }
    }

    // Check explicit import declarations
    let angularCoreMatched = false;
    let rxjsExplicitlyMatched = false;
    const matchedImportNames: Array<{ name: string; depIds: string[]; spec: string }> = [];

    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      const matchingDeps: DependencyDelta[] = [];

      for (const dep of applicableDeps) {
        if (tsImportMatchesPackage(spec, dep.name)) {
          matchingDeps.push(dep);
        }
      }
      if (matchingDeps.length === 0) continue;

      const depIds = Array.from(new Set(matchingDeps.map((d) => d.id)));
      const line = imp.getStartLineNumber();
      const named = imp.getNamedImports().map((n) => n.getName());
      const defaultImp = imp.getDefaultImport()?.getText();
      const nsImp = imp.getNamespaceImport()?.getText();
      const importedSymbols = [
        ...named,
        ...(defaultImp ? [defaultImp] : []),
        ...(nsImp ? [nsImp] : []),
      ];

      if (spec.startsWith("@angular/core") || spec.startsWith("@angular/common")) {
        angularCoreMatched = true;
      }
      if (spec === "rxjs" || spec.startsWith("rxjs/")) {
        rxjsExplicitlyMatched = true;
      }

      const tagsForImport = new Set<CriticalPathTag>(classDecoratorTags);
      if (!testFile && importedSymbols.some((s) => SIGNAL_FUNCTIONS.has(s))) {
        tagsForImport.add("Signal");
      }
      if (!testFile && (spec === "rxjs" || spec.startsWith("rxjs/") || spec.includes("rxjs-interop"))) {
        tagsForImport.add("RxJS");
      }

      const tpTags = Array.from(tagsForImport);
      addTouchpoint(relPath, {
        language: "typescript",
        ecosystem: "typescript",
        filePath: relPath,
        line,
        kind: "import",
        symbolName: importedSymbols.join(", ") || spec,
        matchedImport: spec,
        matchedDependencyIds: depIds,
        criticalPathTags: tpTags,
        isCriticalPath: tpTags.length > 0,
        snippet: getLineSnippet(lines, line),
      });

      for (const sym of importedSymbols) {
        matchedImportNames.push({ name: sym, depIds, spec });
      }
      for (const dep of matchingDeps) {
        recordPackageMapping(dep, spec, relPath);
      }
    }

    // Handle transitive RxJS pipeline usage via HttpClient (.subscribe / .pipe) in Angular services/components
    const rxjsDeps = applicableDeps.filter((d) => d.name === "rxjs");
    if (
      rxjsDeps.length > 0 &&
      !testFile &&
      !rxjsExplicitlyMatched &&
      (rxjsCalls.some((c) => c.name === "subscribe" || c.name === "pipe") ||
        sf.getImportDeclarations().some((i) => i.getModuleSpecifierValue() === "@angular/common/http"))
    ) {
      const rxjsDepIds = rxjsDeps.map((d) => d.id);
      const firstRx = rxjsCalls[0];
      if (firstRx) {
        const tpTags = Array.from(new Set([...classDecoratorTags, "RxJS" as CriticalPathTag]));
        addTouchpoint(relPath, {
          language: "typescript",
          ecosystem: "typescript",
          filePath: relPath,
          line: firstRx.line,
          kind: "rxjs",
          symbolName: `${firstRx.name}()`,
          matchedImport: "rxjs (Observable / HttpClient pipeline)",
          matchedDependencyIds: rxjsDepIds,
          criticalPathTags: tpTags,
          isCriticalPath: true,
          snippet: getLineSnippet(lines, firstRx.line),
        });
        for (const rd of rxjsDeps) {
          recordPackageMapping(rd, "rxjs (Observable pipeline)", relPath);
        }
      }
    }

    if (!fileMatchedDeps.has(relPath)) continue;

    const fileDepIds = Array.from(fileMatchedDeps.get(relPath)!);

    // Record @Component / @Injectable class declarations
    for (const decCls of decoratedClasses) {
      const tags: CriticalPathTag[] = [];
      if (!testFile && decCls.tag) tags.push(decCls.tag);
      addTouchpoint(relPath, {
        language: "typescript",
        ecosystem: "typescript",
        filePath: relPath,
        line: decCls.line,
        endLine: decCls.endLine,
        kind: "decorator",
        symbolName: `@${decCls.decoratorName} ${decCls.name}`,
        matchedImport: Array.from(fileMatchedPkgs.get(relPath)!)[0] ?? `@${decCls.decoratorName}`,
        matchedDependencyIds: fileDepIds,
        criticalPathTags: tags,
        isCriticalPath: tags.length > 0,
        snippet: getLineSnippet(lines, decCls.line),
      });
    }

    // Record Signal call sites when @angular/core or Signal-related dep changed
    if (!testFile && (angularCoreMatched || fileMatchedDeps.has(relPath))) {
      for (const sig of signalCalls) {
        if (
          matchedImportNames.some((m) => m.name === sig.name) ||
          angularCoreMatched
        ) {
          addTouchpoint(relPath, {
            language: "typescript",
            ecosystem: "typescript",
            filePath: relPath,
            line: sig.line,
            kind: "signal",
            symbolName: `${sig.name}()`,
            matchedImport: "@angular/core",
            matchedDependencyIds: fileDepIds,
            criticalPathTags: Array.from(new Set([...classDecoratorTags, "Signal" as CriticalPathTag])),
            isCriticalPath: true,
            snippet: getLineSnippet(lines, sig.line),
          });
        }
      }
    }

    // Record RxJS call sites when rxjs or @angular/common/http changed
    if (!testFile && (rxjsDeps.length > 0 || rxjsExplicitlyMatched)) {
      for (const rx of rxjsCalls) {
        if (rx.name === "subscribe" || rx.name === "pipe" || matchedImportNames.some((m) => m.name === rx.name)) {
          const rxIds = rxjsDeps.length > 0 ? rxjsDeps.map((d) => d.id) : fileDepIds;
          addTouchpoint(relPath, {
            language: "typescript",
            ecosystem: "typescript",
            filePath: relPath,
            line: rx.line,
            kind: "rxjs",
            symbolName: `${rx.name}()`,
            matchedImport: "rxjs",
            matchedDependencyIds: rxIds,
            criticalPathTags: Array.from(new Set([...classDecoratorTags, "RxJS" as CriticalPathTag])),
            isCriticalPath: true,
            snippet: getLineSnippet(lines, rx.line),
          });
        }
      }
    }
  }

  // 1-hop DTO / Model interface propagation from affected Angular services / core / HTTP / Signal files
  for (const [relPath, sf] of sourceFilesByRel.entries()) {
    const depIds = fileMatchedDeps.get(relPath);
    if (!depIds || depIds.size === 0 || isTestFile(relPath)) continue;
    const tps = fileTouchpoints.get(relPath) ?? [];
    const touchesCoreOrServiceOrRx = tps.some(
      (tp) =>
        tp.matchedImport.startsWith("@angular/core") ||
        tp.matchedImport.startsWith("@angular/common") ||
        tp.matchedImport.startsWith("rxjs") ||
        tp.criticalPathTags.includes("@Injectable") ||
        tp.criticalPathTags.includes("Signal") ||
        tp.criticalPathTags.includes("RxJS"),
    );
    if (!touchesCoreOrServiceOrRx) continue;

    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      if (!spec.startsWith(".")) continue;

      const resolvedBase = path.posix.normalize(
        path.posix.join(path.posix.dirname(relPath), spec),
      );
      const candidates = [
        resolvedBase,
        `${resolvedBase}.ts`,
        `${resolvedBase}/index.ts`,
      ];
      const targetRel = candidates.find((c) => sourceFilesByRel.has(c));
      if (!targetRel) continue;
      if (!isModelOrDtoFile(targetRel)) continue;

      const targetSf = sourceFilesByRel.get(targetRel)!;
      const targetLines = getLines(targetSf, targetRel);
      const propagatedIds = Array.from(depIds);

      for (const iface of targetSf.getInterfaces()) {
        const name = iface.getName();
        const line = iface.getStartLineNumber();
        addTouchpoint(targetRel, {
          language: "typescript",
          ecosystem: "typescript",
          filePath: targetRel,
          line,
          endLine: iface.getEndLineNumber(),
          kind: "interface",
          symbolName: name,
          matchedImport: `${relPath} -> ${spec}`,
          matchedDependencyIds: propagatedIds,
          criticalPathTags: ["DTO"],
          isCriticalPath: true,
          snippet: getLineSnippet(targetLines, line),
        });
      }
      for (const alias of targetSf.getTypeAliases()) {
        const name = alias.getName();
        if (!isDtoInterfaceName(name) && !isModelOrDtoFile(targetRel)) continue;
        const line = alias.getStartLineNumber();
        addTouchpoint(targetRel, {
          language: "typescript",
          ecosystem: "typescript",
          filePath: targetRel,
          line,
          endLine: alias.getEndLineNumber(),
          kind: "interface",
          symbolName: name,
          matchedImport: `${relPath} -> ${spec}`,
          matchedDependencyIds: propagatedIds,
          criticalPathTags: ["DTO"],
          isCriticalPath: true,
          snippet: getLineSnippet(targetLines, line),
        });
      }
    }
  }

  // Also check if a model/DTO file itself directly imported a changed TS dependency
  for (const [relPath, sf] of sourceFilesByRel.entries()) {
    if (!fileTouchpoints.has(relPath) && !isModelOrDtoFile(relPath)) continue;
    const tps = fileTouchpoints.get(relPath);
    if (!tps || tps.length === 0) continue;

    if (isModelOrDtoFile(relPath) && !isTestFile(relPath)) {
      const depIds = Array.from(fileMatchedDeps.get(relPath) ?? []).sort();
      for (const iface of sf.getInterfaces()) {
        const line = iface.getStartLineNumber();
        const key = `${relPath}:${line}:${iface.getName()}`;
        if (!dtoContractKeys.has(key)) {
          dtoContractKeys.add(key);
          dtoContracts.push({
            filePath: relPath,
            line,
            symbolName: iface.getName(),
            language: "typescript",
            kind: "interface",
            matchedDependencyIds: depIds,
            reason: "Angular/TypeScript DTO contract consumed by affected component or service",
          });
        }
      }
      for (const alias of sf.getTypeAliases()) {
        const line = alias.getStartLineNumber();
        const key = `${relPath}:${line}:${alias.getName()}`;
        if (!dtoContractKeys.has(key)) {
          dtoContractKeys.add(key);
          dtoContracts.push({
            filePath: relPath,
            line,
            symbolName: alias.getName(),
            language: "typescript",
            kind: "type",
            matchedDependencyIds: depIds,
            reason: "Angular/TypeScript contract type consumed by affected component or service",
          });
        }
      }
    }
  }

  const affectedFiles: AffectedFileSummary[] = [];

  for (const [relPath, tps] of Array.from(fileTouchpoints.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const depIds = Array.from(fileMatchedDeps.get(relPath) ?? []).sort();
    const pkgs = Array.from(fileMatchedPkgs.get(relPath) ?? []).sort();
    const fileTags = Array.from(
      new Set(tps.flatMap((t) => t.criticalPathTags)),
    );
    const testFile = isTestFile(relPath);
    const isDto = !testFile && (fileTags.includes("DTO") || isModelOrDtoFile(relPath));
    const isCritical = !testFile && fileTags.length > 0;
    const symbols = Array.from(new Set(tps.map((t) => t.symbolName)));
    const sortedTouchpoints = [...tps].sort((a, b) => a.line - b.line);

    const tagBonus =
      (fileTags.includes("@Injectable") ? 15 : 0) +
      (fileTags.includes("Signal") || fileTags.includes("RxJS") ? 12 : 0) +
      (fileTags.includes("@Component") ? 10 : 0) +
      (isDto ? 10 : 0);

    // Verify file still exists on disk cleanly
    const project = inferTsProjectDir(relPath);
    const riskWeight = testFile
      ? 5
      : Math.min(100, 10 + tagBonus + sortedTouchpoints.length * 2);

    affectedFiles.push({
      filePath: relPath,
      language: "typescript",
      ecosystem: "typescript",
      project: fs.existsSync(path.join(repoRoot, project)) ? project : ".",
      isCriticalPath: isCritical,
      isDtoOrContract: isDto,
      criticalPathTags: fileTags,
      matchedDependencyIds: depIds,
      matchedPackages: pkgs,
      touchpointCount: sortedTouchpoints.length,
      touchpoints: sortedTouchpoints,
      symbols,
      riskWeight,
    });
  }

  const packageMappings = Array.from(pkgMappingIndex.values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  dtoContracts.sort((a, b) =>
    a.filePath === b.filePath ? a.line - b.line : a.filePath.localeCompare(b.filePath),
  );

  return { affectedFiles, packageMappings, dtoContracts };
}
