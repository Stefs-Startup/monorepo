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

When ``--changed-files``, ``--changed-files-file``, or ``--base-ref`` is passed
(pull requests), only projects impacted by the changed paths are emitted, and
root pnpm workspace package changes include ``turbo-filter=...[<base-ref>]`` so
Turborepo builds/tests only modified packages and their workspace dependents.
On pushes to ``main``, merge queues, or ``--all`` (default with no filters), all
projects are emitted with ``turbo-filter=""``.

``.github/ci-projects.json`` can exclude paths (experimental projects) or override
a project's reusable-workflow inputs. Results are written to ``$GITHUB_OUTPUT`` as
JSON matrices and printed as a table for local use
(``python3 .github/scripts/discover_projects.py``).
"""

from __future__ import annotations

import argparse
import fnmatch
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
ANDROID_PATTERN = re.compile(r"com\.android\.|libs\.plugins\.android\b|stefs\.android-app\b|^\s*android\s*\{", re.MULTILINE)
KMP_PATTERN = re.compile(r'kotlin\(\s*"multiplatform"\s*\)|org\.jetbrains\.kotlin\.multiplatform|stefs\.kotlin-lib\b', re.MULTILINE)

GLOBAL_CI_PATHS = (
    ".github/workflows/ci.yml",
    ".github/ci-projects.json",
    "scripts/check.sh",
)
GLOBAL_CI_PREFIXES = (
    ".github/workflows/reusable-",
    ".github/scripts/",
)
STACK_WORKFLOW_MAP: dict[str, tuple[str, str]] = {
    ".github/workflows/ci-stack-pnpm-turborepo.yml": ("node", "."),
    ".github/workflows/ci-stack-angular.yml": ("node", "apps/pulse/web"),
    ".github/workflows/ci-stack-springboot-java.yml": ("gradle", "apps/pulse/backend"),
    ".github/workflows/ci-stack-kmp-multiplatform.yml": ("gradle", "apps/pulse/kmp"),
    ".github/workflows/ci-stack-android-kotlin.yml": ("gradle", "apps/pulse"),
}
CONTRACT_TRIGGER_TARGETS: tuple[tuple[str, str], ...] = (
    ("gradle", "apps/pulse/backend"),
    ("gradle", "apps/pulse/kmp"),
    ("node", "apps/pulse/web"),
)
ROOT_GLOBAL_CONFIG_FILES = frozenset(
    {
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "turbo.json",
        ".nvmrc",
        ".node-version",
        ".dependency-cruiser.cjs",
        "mise.toml",
    }
)


def tracked_files(root_dir: Path = ROOT) -> list[PurePosixPath]:
    """Only git-tracked files, so node_modules, build dirs and caches never match."""
    out = subprocess.run(
        ["git", "ls-files", "-z"], cwd=root_dir, check=True, capture_output=True, text=True
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


def node_version(project_dir: Path, manifest: dict[str, Any], root_dir: Path = ROOT) -> str:
    """Project .nvmrc/.node-version, then a plain engines.node, then the repo root default."""
    local = read_version_file(project_dir)
    if local:
        return local
    engines = str(manifest.get("engines", {}).get("node", "")).strip()
    if re.fullmatch(r"\d+(\.\d+){0,2}", engines):
        return engines
    return read_version_file(root_dir) or DEFAULT_NODE


def parse_workspace_globs(directory: Path) -> tuple[list[str], list[str]]:
    """Parses positive and negated (`!...`) package globs from pnpm-workspace.yaml."""
    config = directory / "pnpm-workspace.yaml"
    if not config.is_file():
        return ([], [])
    raw_entries = re.findall(
        r"^\s*-\s*['\"]?([^'#\s][^#\s]*?)['\"]?\s*$",
        config.read_text(),
        re.MULTILINE,
    )
    includes: list[str] = []
    excludes: list[str] = []
    for entry in raw_entries:
        cleaned = entry.strip("'\"")
        if not cleaned:
            continue
        if cleaned.startswith("!"):
            excludes.append(cleaned[1:].lstrip("./").rstrip("/"))
        else:
            includes.append(cleaned.lstrip("./").rstrip("/"))
    return (includes, excludes)


def workspace_dist_globs(directory: Path) -> list[str]:
    """`<glob>/dist` for each positive package glob of a pnpm workspace root."""
    includes, _excludes = parse_workspace_globs(directory)
    return [f"{g}/dist" for g in includes]


def discover_gradle(
    files: list[PurePosixPath], excludes: list[str], root_dir: Path = ROOT
) -> list[dict[str, Any]]:
    roots = sorted({f.parent for f in files if f.name == "gradlew" and not is_excluded(f.parent, excludes)})
    projects = []
    for root in roots:
        nested = [r for r in roots if r != root and root in r.parents]
        build_files = [
            f
            for f in files
            if (root == f.parent or root in f.parents)
            and not any(n == f.parent or n in n.parents for n in nested)
            and f.name.endswith((".gradle", ".gradle.kts"))
        ]
        is_android = any(ANDROID_PATTERN.search((root_dir / f).read_text(errors="ignore")) for f in build_files)
        is_kmp = any(KMP_PATTERN.search((root_dir / f).read_text(errors="ignore")) for f in build_files)
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


def discover_node(
    files: list[PurePosixPath], excludes: list[str], root_dir: Path = ROOT
) -> list[dict[str, Any]]:
    tracked = set(files)
    projects = []
    for manifest_path in sorted(f for f in files if f.name == "package.json"):
        directory = manifest_path.parent
        if is_excluded(directory, excludes):
            continue
        lock = next((name for name in LOCKFILES if directory / name in tracked), None)
        if lock is None:
            continue  # workspace member or template without its own lockfile
        manifest = json.loads((root_dir / manifest_path).read_text())
        scripts = manifest.get("scripts", {})
        projects.append(
            {
                "path": str(directory),
                "artifact-name": f"node-{slug(directory)}",
                "pm": LOCKFILES[lock],
                "defined-scripts": " ".join(s for s in NODE_SCRIPTS if s in scripts),
                # Inputs of reusable-node.yml.
                "node-version": node_version(root_dir / directory, manifest, root_dir=root_dir),
                "scripts": " ".join(NODE_SCRIPTS),
                "artifact-paths": "\n".join(workspace_dist_globs(root_dir / directory)) or "dist",
                "turbo-filter": "",
            }
        )
    return projects


def apply_overrides(projects: list[dict[str, Any]], overrides: dict[str, dict[str, Any]]) -> None:
    for project in projects:
        project.update(overrides.get(project["path"], {}))


def normalize_changed_path(raw_path: str) -> str:
    cleaned = raw_path.strip().replace("\\", "/")
    while cleaned.startswith("./"):
        cleaned = cleaned[2:]
    return cleaned.strip("/")


def path_is_within(path_str: str, project_path: str) -> bool:
    if project_path == ".":
        return True
    return path_str == project_path or path_str.startswith(f"{project_path}/")


def path_matches_workspace_member(
    path_str: str,
    includes: list[str],
    excludes: list[str],
) -> bool:
    for exc in excludes:
        trimmed = exc[:-3] if exc.endswith("/**") else exc
        if trimmed and path_is_within(path_str, trimmed):
            return False

    for inc in includes:
        base_glob = inc.rstrip("/")
        if "*" in base_glob:
            # e.g. apps/* or packages/*: member root is the directory matched by the glob
            if fnmatch.fnmatch(path_str, base_glob) or fnmatch.fnmatch(path_str, f"{base_glob}/**"):
                return True
            parts = path_str.split("/")
            glob_parts = base_glob.split("/")
            if len(parts) >= len(glob_parts):
                prefix = "/".join(parts[: len(glob_parts)])
                if fnmatch.fnmatch(prefix, base_glob):
                    return True
        elif path_is_within(path_str, base_glob):
            return True

    return False


def classify_changed_paths(
    changed_paths: list[str],
    gradle_projects: list[dict[str, Any]],
    node_projects: list[dict[str, Any]],
    workspace_globs: tuple[list[str], list[str]],
    turbo_base_ref: str = "origin/main",
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Filter discovered Gradle and Node projects down to only those impacted by `changed_paths`."""
    normalized = [p for p in (normalize_changed_path(raw) for raw in changed_paths) if p]
    if not normalized:
        return ([], [])

    gradle_by_path = {p["path"]: dict(p) for p in gradle_projects}
    node_by_path = {p["path"]: dict(p) for p in node_projects}

    non_root_owners: list[tuple[str, str, str]] = []
    for path_key in gradle_by_path:
        if path_key != ".":
            non_root_owners.append((path_key, "gradle", path_key))
    for path_key in node_by_path:
        if path_key != ".":
            non_root_owners.append((path_key, "node", path_key))
    # Match most-specific nested directory first so apps/pulse/{backend,kmp,web}
    # do not falsely trigger parent Android project apps/pulse.
    non_root_owners.sort(key=lambda item: (-len(PurePosixPath(item[0]).parts), -len(item[0])))

    selected_gradle: set[str] = set()
    selected_node: set[str] = set()
    root_full_required = False
    root_workspace_member_touched = False
    includes, excludes = workspace_globs

    for path_str in normalized:
        if path_str in GLOBAL_CI_PATHS or any(path_str.startswith(prefix) for prefix in GLOBAL_CI_PREFIXES):
            return (
                [dict(p) for p in gradle_projects],
                [{**dict(p), "turbo-filter": ""} for p in node_projects],
            )

        if path_str in STACK_WORKFLOW_MAP:
            kind, target = STACK_WORKFLOW_MAP[path_str]
            if kind == "gradle" and target in gradle_by_path:
                selected_gradle.add(target)
            elif kind == "node" and target in node_by_path:
                selected_node.add(target)
                if target == ".":
                    root_full_required = True
            continue

        if (
            path_is_within(path_str, "apps/pulse/contracts")
            or path_str in ("scripts/api-contract.sh", ".github/workflows/ci-contract-pulse-api.yml")
        ):
            for kind, target in CONTRACT_TRIGGER_TARGETS:
                if kind == "gradle" and target in gradle_by_path:
                    selected_gradle.add(target)
                elif kind == "node" and target in node_by_path:
                    selected_node.add(target)
            continue

        if path_str in ROOT_GLOBAL_CONFIG_FILES and "." in node_by_path:
            selected_node.add(".")
            root_full_required = True
            continue

        if path_str == "gradle/libs.versions.toml" or path_is_within(path_str, "build-logic"):
            selected_gradle.update(gradle_by_path.keys())
            continue

        matched_owner = next(
            ((kind, target) for prefix, kind, target in non_root_owners if path_is_within(path_str, prefix)),
            None,
        )
        if matched_owner is not None:
            kind, target = matched_owner
            if kind == "gradle":
                selected_gradle.add(target)
            else:
                selected_node.add(target)
            continue

        if "." in node_by_path and path_matches_workspace_member(path_str, includes, excludes):
            selected_node.add(".")
            root_workspace_member_touched = True

    filtered_gradle = [gradle_by_path[p["path"]] for p in gradle_projects if p["path"] in selected_gradle]
    filtered_node: list[dict[str, Any]] = []
    for p in node_projects:
        if p["path"] not in selected_node:
            continue
        entry = dict(p)
        if p["path"] == "." and root_workspace_member_touched and not root_full_required:
            entry["turbo-filter"] = f"...[{turbo_base_ref}]"
        else:
            entry["turbo-filter"] = ""
        filtered_node.append(entry)

    return (filtered_gradle, filtered_node)


def resolve_git_changed_files(base_ref: str, root_dir: Path = ROOT) -> list[str] | None:
    """Computes changed files relative to `base_ref`, returning None if git diff cannot resolve safely."""
    verify = subprocess.run(
        ["git", "rev-parse", "--verify", "-q", base_ref],
        cwd=root_dir,
        capture_output=True,
        text=True,
    )
    if verify.returncode != 0:
        return None

    mb = subprocess.run(
        ["git", "merge-base", base_ref, "HEAD"],
        cwd=root_dir,
        capture_output=True,
        text=True,
    )
    diff_base = mb.stdout.strip() if mb.returncode == 0 and mb.stdout.strip() else base_ref
    diff = subprocess.run(
        ["git", "diff", "--name-only", f"{diff_base}..HEAD"],
        cwd=root_dir,
        capture_output=True,
        text=True,
    )
    if diff.returncode != 0:
        return None
    return [line.strip() for line in diff.stdout.splitlines() if line.strip()]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Discover monorepo Gradle and Node CI projects with optional affected-only PR filtering."
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Emit all projects without path filtering (default on main/merge_group).",
    )
    parser.add_argument(
        "--changed-files",
        action="append",
        default=[],
        help="Comma-separated or repeatable changed file path(s) to filter impacted projects.",
    )
    parser.add_argument(
        "--changed-files-file",
        default="",
        help="Path to newline-separated file of changed paths.",
    )
    parser.add_argument(
        "--base-ref",
        default="",
        help="Git base ref (e.g. origin/main) used to compute changed files and Turborepo --filter.",
    )
    parser.add_argument(
        "--turbo-base-ref",
        default="",
        help="Explicit base ref inside ...[<ref>] for root Turborepo filter (defaults to --base-ref or origin/main).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print JSON `{gradle, node}` matrices to stdout instead of the text summary table.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    config = json.loads(CONFIG_PATH.read_text()) if CONFIG_PATH.is_file() else {}
    excludes: list[str] = config.get("exclude", [])
    overrides: dict[str, dict[str, Any]] = config.get("overrides", {})

    files = tracked_files(ROOT)
    gradle = discover_gradle(files, excludes, root_dir=ROOT)
    node = discover_node(files, excludes, root_dir=ROOT)
    apply_overrides(gradle, overrides)
    apply_overrides(node, overrides)

    filter_mode = False
    changed_paths: list[str] = []

    if not args.all:
        if args.changed_files or args.changed_files_file:
            filter_mode = True
            for raw_item in args.changed_files:
                changed_paths.extend(part for part in raw_item.split(",") if part.strip())
            if args.changed_files_file:
                changed_file_path = Path(args.changed_files_file)
                if not changed_file_path.is_file():
                    print(f"WARN: --changed-files-file not found ({changed_file_path}); falling back to --all", file=sys.stderr)
                    filter_mode = False
                else:
                    changed_paths.extend(
                        line.strip() for line in changed_file_path.read_text().splitlines() if line.strip()
                    )
        elif args.base_ref:
            resolved = resolve_git_changed_files(args.base_ref, root_dir=ROOT)
            if resolved is None:
                print(
                    f"WARN: Unable to resolve git diff against '{args.base_ref}'; falling back to full matrix",
                    file=sys.stderr,
                )
            else:
                filter_mode = True
                changed_paths = resolved

    if filter_mode:
        turbo_base_ref = args.turbo_base_ref or args.base_ref or "origin/main"
        gradle, node = classify_changed_paths(
            changed_paths,
            gradle,
            node,
            parse_workspace_globs(ROOT),
            turbo_base_ref=turbo_base_ref,
        )

    if args.json:
        print(json.dumps({"gradle": gradle, "node": node}, indent=2))
    else:
        print(f"{'workflow':<16} {'path':<22} details")
        for p in gradle:
            print(f"{'reusable-gradle':<16} {p['path']:<22} {p['project-type']}, JDK {p['java-version']}")
        for p in node:
            filter_note = f", filter={p['turbo-filter']}" if p.get("turbo-filter") else ""
            print(
                f"{'reusable-node':<16} {p['path']:<22} {p['pm']}, Node {p['node-version']}{filter_note}: "
                f"{p['defined-scripts'] or '(no scripts)'} -> {p['artifact-paths'].replace(chr(10), ', ')}"
            )
        if not gradle and not node:
            print("(no affected projects)")
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
