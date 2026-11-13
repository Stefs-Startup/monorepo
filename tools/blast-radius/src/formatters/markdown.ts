import type { BlastRadiusReport, ConfidenceTier } from "../types.js";

export const BLAST_RADIUS_COMMENT_MARKER = "<!-- cmp-blast-radius-report -->";

function tierBadge(tier: ConfidenceTier): string {
  switch (tier) {
    case "HIGH CONFIDENCE / AUTO-MERGE":
      return "🟢 **HIGH CONFIDENCE / AUTO-MERGE**";
    case "MODERATE - VERIFY TESTS":
      return "🟡 **MODERATE - VERIFY TESTS**";
    case "CRITICAL PATH TOUCHED - MANUAL REVIEW":
      return "🔴 **CRITICAL PATH TOUCHED - MANUAL REVIEW**";
  }
}

function escapeMdCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/**
 * Formats a BlastRadiusReport into a compact, scannable PR comment Markdown report.
 */
export function formatBlastRadiusMarkdown(report: BlastRadiusReport): string {
  const lines: string[] = [];
  const criticalFiles = report.affectedFiles.filter((f) => f.isCriticalPath);

  lines.push(BLAST_RADIUS_COMMENT_MARKER);
  lines.push("## Dependency Blast-Radius Scorecard");
  lines.push("");
  lines.push(`- **Confidence Tier:** ${tierBadge(report.scoring.confidenceTier)}`);
  lines.push(
    `- **Effort Score:** \`${report.scoring.effortScore} / 100\` | **Gate Exit:** \`${report.scoring.gateExitCode}\` | **Auto-Merge:** \`${report.scoring.autoMergeEligible ? "yes" : "no"}\``,
  );
  lines.push(
    `- **Scope:** \`${report.baseRef}\` → \`${report.headRef}\` | **Deltas:** \`${report.dependencies.length}\` | **Critical Files:** \`${criticalFiles.length}\` | **DTOs:** \`${report.dtoContracts.length}\` | **SBOM Alerts:** \`${report.sbom.alerts.length}\``,
  );
  lines.push("");

  if (report.dependencies.length === 0) {
    lines.push(`> No dependency changes detected between \`${report.baseRef}\` and \`${report.headRef}\`.`);
    lines.push("");
  }

  if (criticalFiles.length > 0) {
    lines.push("### Top Critical-Path Touchpoints");
    lines.push("");
    lines.push("| File | Boundary | Symbols & Lines |");
    lines.push("| :--- | :--- | :--- |");
    const maxFiles = 10;
    for (const file of criticalFiles.slice(0, maxFiles)) {
      const tags = file.criticalPathTags.map((t) => `\`${t}\``).join(", ");
      const symLines = file.touchpoints
        .slice(0, 3)
        .map((tp) => `\`${escapeMdCell(tp.symbolName)}\`:L${tp.line}`)
        .join(", ");
      const extra = file.touchpoints.length > 3 ? ` (+${file.touchpoints.length - 3})` : "";
      lines.push(`| \`${escapeMdCell(file.filePath)}\` | ${tags} | ${symLines}${extra} |`);
    }
    if (criticalFiles.length > maxFiles) {
      lines.push(`| … | _+${criticalFiles.length - maxFiles} more critical-path files_ | |`);
    }
    lines.push("");
  }

  if (report.dependencies.length > 0) {
    lines.push(`<details><summary>Dependency Deltas (${report.dependencies.length})</summary>`);
    lines.push("");
    lines.push("| Ecosystem | Package | From | To | Bump | Direct |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");
    const maxDeps = 40;
    for (const dep of report.dependencies.slice(0, maxDeps)) {
      lines.push(
        `| \`${dep.ecosystem}\` | \`${escapeMdCell(dep.name)}\` | \`${dep.fromVersion ?? "—"}\` | \`${dep.toVersion ?? "—"}\` | \`${dep.bumpKind}\` | ${dep.direct ? "direct" : "transitive"} |`,
      );
    }
    if (report.dependencies.length > maxDeps) {
      lines.push(`| … | _+${report.dependencies.length - maxDeps} more_ | | | | |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  if (report.dtoContracts.length > 0) {
    lines.push(`<details><summary>DTO / Contract Touchpoints (${report.dtoContracts.length})</summary>`);
    lines.push("");
    lines.push("| Symbol | Kind | Location | Reason |");
    lines.push("| :--- | :--- | :--- | :--- |");
    for (const dto of report.dtoContracts) {
      lines.push(
        `| \`${escapeMdCell(dto.symbolName)}\` | \`${dto.kind}\` | \`${escapeMdCell(dto.filePath)}:${dto.line}\` | ${escapeMdCell(dto.reason)} |`,
      );
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  if (report.openRewrite.filesChanged > 0) {
    lines.push(
      `<details><summary>OpenRewrite / Migration Diffs (${report.openRewrite.filesChanged} files, +${report.openRewrite.totalAdditions}/-${report.openRewrite.totalDeletions})</summary>`,
    );
    lines.push("");
    for (const summary of report.openRewrite.summaryLines.slice(0, 20)) {
      lines.push(`- ${summary}`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  if (report.sbom.alerts.length > 0) {
    lines.push(`<details><summary>SBOM Alerts (${report.sbom.alerts.length})</summary>`);
    lines.push("");
    for (const alert of report.sbom.alerts) {
      lines.push(`- **[${alert.severity.toUpperCase()}]** \`${alert.dependencyName}\`: ${alert.title}`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
