#!/usr/bin/env python3
"""Unit tests for .github/scripts/discover_projects.py (STE-40)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import discover_projects as dp  # noqa: E402


class DiscoverProjectsTests(unittest.TestCase):
    def setUp(self) -> None:
        files = dp.tracked_files(REPO_ROOT)
        config = json.loads((REPO_ROOT / ".github" / "ci-projects.json").read_text())
        excludes = config.get("exclude", [])
        overrides = config.get("overrides", {})
        self.gradle = dp.discover_gradle(files, excludes, root_dir=REPO_ROOT)
        self.node = dp.discover_node(files, excludes, root_dir=REPO_ROOT)
        dp.apply_overrides(self.gradle, overrides)
        dp.apply_overrides(self.node, overrides)
        self.workspace_globs = dp.parse_workspace_globs(REPO_ROOT)

    def test_full_discovery_finds_expected_monorepo_projects(self) -> None:
        gradle_paths = sorted(p["path"] for p in self.gradle)
        node_paths = sorted(p["path"] for p in self.node)
        self.assertEqual(gradle_paths, ["apps/pulse", "apps/pulse/backend", "apps/pulse/kmp"])
        self.assertEqual(node_paths, [".", "apps/pulse/web"])
        self.assertTrue(all(p["turbo-filter"] == "" for p in self.node))

    def test_docs_only_change_returns_zero_projects(self) -> None:
        gradle, node = dp.classify_changed_paths(
            ["docs/README.md", "docs/rfcs/0001-crossplane-kubernetes-control-plane.md"],
            self.gradle,
            self.node,
            self.workspace_globs,
        )
        self.assertEqual(gradle, [])
        self.assertEqual(node, [])

    def test_shared_package_change_triggers_root_node_with_turbo_filter(self) -> None:
        for path in ("packages/utils/src/index.ts", "packages/config/tsconfig.base.json", "tools/blast-radius/src/cli.ts"):
            with self.subTest(path=path):
                gradle, node = dp.classify_changed_paths(
                    [path],
                    self.gradle,
                    self.node,
                    self.workspace_globs,
                    turbo_base_ref="origin/main",
                )
                self.assertEqual(gradle, [])
                self.assertEqual(len(node), 1)
                self.assertEqual(node[0]["path"], ".")
                self.assertEqual(node[0]["turbo-filter"], "...[origin/main]")

    def test_root_lockfile_or_turbo_config_forces_unscoped_root_run(self) -> None:
        for path in ("package.json", "pnpm-lock.yaml", "turbo.json", "pnpm-workspace.yaml", ".nvmrc"):
            with self.subTest(path=path):
                gradle, node = dp.classify_changed_paths(
                    [path, "packages/utils/src/index.ts"],
                    self.gradle,
                    self.node,
                    self.workspace_globs,
                )
                self.assertEqual(gradle, [])
                self.assertEqual([p["path"] for p in node], ["."])
                self.assertEqual(node[0]["turbo-filter"], "")

    def test_pulse_nested_subprojects_stay_isolated_from_each_other_and_pnpm_workspace(self) -> None:
        gradle, node = dp.classify_changed_paths(
            ["apps/pulse/backend/src/main/java/com/pulse/backend/PulseApp.java"],
            self.gradle,
            self.node,
            self.workspace_globs,
        )
        self.assertEqual([p["path"] for p in gradle], ["apps/pulse/backend"])
        self.assertEqual(node, [])

        gradle, node = dp.classify_changed_paths(
            ["apps/pulse/kmp/src/commonMain/kotlin/App.kt"],
            self.gradle,
            self.node,
            self.workspace_globs,
        )
        self.assertEqual([p["path"] for p in gradle], ["apps/pulse/kmp"])
        self.assertEqual(node, [])

        gradle, node = dp.classify_changed_paths(
            ["apps/pulse/app/src/main/java/MainActivity.kt", "apps/pulse/gradle/libs.versions.toml"],
            self.gradle,
            self.node,
            self.workspace_globs,
        )
        self.assertEqual([p["path"] for p in gradle], ["apps/pulse"])
        self.assertEqual(node, [])

        gradle, node = dp.classify_changed_paths(
            ["apps/pulse/web/src/app/app.component.ts"],
            self.gradle,
            self.node,
            self.workspace_globs,
        )
        self.assertEqual(gradle, [])
        self.assertEqual([p["path"] for p in node], ["apps/pulse/web"])
        self.assertEqual(node[0]["turbo-filter"], "")

    def test_pulse_contract_changes_fan_out_to_backend_kmp_and_web(self) -> None:
        gradle, node = dp.classify_changed_paths(
            ["apps/pulse/contracts/pulse-api.openapi.json"],
            self.gradle,
            self.node,
            self.workspace_globs,
        )
        self.assertEqual(sorted(p["path"] for p in gradle), ["apps/pulse/backend", "apps/pulse/kmp"])
        self.assertEqual([p["path"] for p in node], ["apps/pulse/web"])

    def test_global_ci_changes_trigger_full_matrix_without_turbo_filter(self) -> None:
        for path in (
            ".github/workflows/ci.yml",
            ".github/workflows/reusable-node.yml",
            ".github/scripts/discover_projects.py",
            "scripts/check.sh",
        ):
            with self.subTest(path=path):
                gradle, node = dp.classify_changed_paths(
                    [path, "packages/utils/src/index.ts"],
                    self.gradle,
                    self.node,
                    self.workspace_globs,
                )
                self.assertEqual(len(gradle), len(self.gradle))
                self.assertEqual(len(node), len(self.node))
                self.assertTrue(all(p["turbo-filter"] == "" for p in node))

    def test_cli_changed_files_and_github_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "github_output.txt"
            env = {**os.environ, "GITHUB_OUTPUT": str(out_path)}

            res_docs = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIR / "discover_projects.py"),
                    "--changed-files",
                    "docs/README.md",
                    "--json",
                ],
                cwd=REPO_ROOT,
                env=env,
                check=True,
                capture_output=True,
                text=True,
            )
            parsed_docs = json.loads(res_docs.stdout)
            self.assertEqual(parsed_docs["gradle"], [])
            self.assertEqual(parsed_docs["node"], [])
            output_lines = out_path.read_text().splitlines()
            self.assertEqual(output_lines[0], "gradle=[]")
            self.assertEqual(output_lines[1], "node=[]")

            res_utils = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIR / "discover_projects.py"),
                    "--changed-files",
                    "packages/utils/src/index.ts",
                    "--turbo-base-ref",
                    "origin/main",
                    "--json",
                ],
                cwd=REPO_ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
            parsed_utils = json.loads(res_utils.stdout)
            self.assertEqual(parsed_utils["gradle"], [])
            self.assertEqual(len(parsed_utils["node"]), 1)
            self.assertEqual(parsed_utils["node"][0]["path"], ".")
            self.assertEqual(parsed_utils["node"][0]["turbo-filter"], "...[origin/main]")

            res_all = subprocess.run(
                [sys.executable, str(SCRIPT_DIR / "discover_projects.py"), "--all", "--json"],
                cwd=REPO_ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
            parsed_all = json.loads(res_all.stdout)
            self.assertEqual(len(parsed_all["gradle"]), 3)
            self.assertEqual(len(parsed_all["node"]), 2)
            self.assertTrue(all(p["turbo-filter"] == "" for p in parsed_all["node"]))


if __name__ == "__main__":
    unittest.main()
