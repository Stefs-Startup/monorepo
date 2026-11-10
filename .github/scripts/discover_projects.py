#!/usr/bin/env python3
"""Discover every buildable project in the monorepo for .github/workflows/ci.yml.

Each discovered project becomes one call of a reusable language workflow, so a new
app is covered by CI as soon as it lands:

* Gradle project -> reusable-gradle.yml
    any directory with a tracked ``gradlew``. Android builds (an Android plugin
    applied in one of its build scripts) run ``lintDebug`` / ``assembleDebug`` /
    ``testDebugUnitTest``; other JVM builds run ``assemble testClasses`` / ``test``.
* Node project -> reusable-node.yml
    any directory (including the root pnpm/Turborepo workspace) with
    ``package.json`` plus its own lockfile. Runs whichever of ``lint``,
    ``typecheck``, ``build`` and ``test`` the package.json defines.

``.github/ci-projects.json`` can exclude paths (experimental projects) or override
a project's reusable-workflow inputs. Results are written to ``$GITHUB_OUTPUT`` as
JSON matrices and printed as a table for local use
(``python3 .github/scripts/discover_projects.py``).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / ".github" / "ci-projects.json"
NODE_SCRIPTS = ("lint", "typecheck", "build", "test")
LOCKFILES = {"package-lock.json": "npm", "yarn.lock": "yarn", "pnpm-lock.yaml": "pnpm"}
DEFAULT_JAVA = "21"
DEFAULT_NODE = "20"
# Applied Android plugin or `android { }` block in a build script. Version catalogs are
# deliberately ignored: a catalog may declare Android plugins a JVM build never applies.
ANDROID_PATTERN = re.compile(r"com\.android\.|libs\.plugins\.android\b|^\s*android\s*\{", re.MULTILINE)
KMP_PATTERN = re.compile(r'kotlin\(\s*"multiplatform"\s*\)|org\.jetbrains\.kotlin\.multiplatform', re.MULTILINE)


def tracked_files() -> list[PurePosixPath]:
    """Only git-tracked files, so node_modules, build dirs and caches never match."""
    out = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True, text=True
    ).stdout
    return [PurePosixPath(p) for p in out.split("\0") if p]


def is_excluded(path: PurePosixPath, excludes: list[str]) -> bool:
    return any(path == PurePosixPath(e) or PurePosixPath(e) in path.parents for e in excludes)


def slug(path: PurePosixPath) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", str(path)).strip("-") or "root"


def read_version_file(directory: Path) -> str | None:
    for name in (".nvmrc", ".node-version"):
        candidate = directory / name
        if candidate.is_file():
            value = candidate.read_text().strip().lstrip("v")
            if value:
                return value
    return None


def node_version(project_dir: Path, manifest: dict[str, Any]) -> str:
    """Project .nvmrc/.node-version, then a plain engines.node, then the repo root default."""
    local = read_version_file(project_dir)
    if local:
        return local
    engines = str(manifest.get("engines", {}).get("node", "")).strip()
    if re.fullmatch(r"\d+(\.\d+){0,2}", engines):
        return engines
    return read_version_file(ROOT) or DEFAULT_NODE


def workspace_dist_globs(directory: Path) -> list[str]:
    """`<glob>/dist` for each package glob of a pnpm workspace root (build outputs live in members)."""
    config = directory / "pnpm-workspace.yaml"
    if not config.is_file():
        return []
    globs = re.findall(r"^\s*-\s*['\"]?([^'\"!#\s][^'\"#\s]*)['\"]?\s*$", config.read_text(), re.MULTILINE)
    return [f"{g.rstrip('/')}/dist" for g in globs]


def discover_gradle(files: list[PurePosixPath], excludes: list[str]) -> list[dict[str, Any]]:
    roots = sorted({f.parent for f in files if f.name == "gradlew" and not is_excluded(f.parent, excludes)})
    projects = []
    for root in roots:
        nested = [r for r in roots if r != root and root in r.parents]
        build_files = [
            f
            for f in files
            if (root == f.parent or root in f.parents)
            and not any(n == f.parent or n in f.parents for n in nested)
            and f.name.endswith((".gradle", ".gradle.kts"))
        ]
        is_android = any(ANDROID_PATTERN.search((ROOT / f).read_text(errors="ignore")) for f in build_files)
        is_kmp = any(KMP_PATTERN.search((ROOT / f).read_text(errors="ignore")) for f in build_files)
        project_type = "android" if is_android else ("kmp" if is_kmp else "jvm")
        projects.append(
            {
                "path": str(root),
                "artifact-name": f"gradle-{slug(root)}",
                # Inputs of reusable-gradle.yml ("default" = that workflow's per-type default).
                "project-type": project_type,
                "java-version": DEFAULT_JAVA,
                "quality-tasks": "default",
                "build-tasks": "default",
                "test-tasks": "default",
            }
        )
    return projects


def discover_node(files: list[PurePosixPath], excludes: list[str]) -> list[dict[str, Any]]:
    tracked = set(files)
    projects = []
    for manifest_path in sorted(f for f in files if f.name == "package.json"):
        directory = manifest_path.parent
        if is_excluded(directory, excludes):
            continue
        lock = next((name for name in LOCKFILES if directory / name in tracked), None)
        if lock is None:
            continue  # workspace member or template without its own lockfile
        manifest = json.loads((ROOT / manifest_path).read_text())
        scripts = manifest.get("scripts", {})
        projects.append(
            {
                "path": str(directory),
                "artifact-name": f"node-{slug(directory)}",
                "pm": LOCKFILES[lock],
                "defined-scripts": " ".join(s for s in NODE_SCRIPTS if s in scripts),
                # Inputs of reusable-node.yml.
                "node-version": node_version(ROOT / directory, manifest),
                "scripts": " ".join(NODE_SCRIPTS),
                "artifact-paths": "\n".join(workspace_dist_globs(ROOT / directory)) or "dist",
            }
        )
    return projects


def apply_overrides(projects: list[dict[str, Any]], overrides: dict[str, dict[str, Any]]) -> None:
    for project in projects:
        project.update(overrides.get(project["path"], {}))


def main() -> int:
    config = json.loads(CONFIG_PATH.read_text()) if CONFIG_PATH.is_file() else {}
    excludes: list[str] = config.get("exclude", [])
    overrides: dict[str, dict[str, Any]] = config.get("overrides", {})

    files = tracked_files()
    gradle = discover_gradle(files, excludes)
    node = discover_node(files, excludes)
    apply_overrides(gradle, overrides)
    apply_overrides(node, overrides)

    print(f"{'workflow':<16} {'path':<22} details")
    for p in gradle:
        print(f"{'reusable-gradle':<16} {p['path']:<22} {p['project-type']}, JDK {p['java-version']}")
    for p in node:
        print(
            f"{'reusable-node':<16} {p['path']:<22} {p['pm']}, Node {p['node-version']}: "
            f"{p['defined-scripts'] or '(no scripts)'} -> {p['artifact-paths'].replace(chr(10), ', ')}"
        )
    for e in excludes:
        print(f"{'(excluded)':<16} {e}")

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as fh:
            fh.write(f"gradle={json.dumps(gradle, separators=(',', ':'))}\n")
            fh.write(f"node={json.dumps(node, separators=(',', ':'))}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
