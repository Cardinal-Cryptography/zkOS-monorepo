#!/usr/bin/env node

import fs from "fs";
import path from "path";

function generateCoverageReport() {
  // Read the coverage summary JSON
  const coverageData = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "coverage", "coverage-summary.json"),
      "utf8"
    )
  );

  let markdown = "# 📊 Coverage Report\n\n";

  // Add total coverage section
  markdown += "## 📈 Total Coverage Summary\n\n";
  markdown += "| Type | Covered | Total | Coverage |\n";
  markdown += "|------|---------|--------|----------|\n";

  const total = coverageData.total;
  const getCoverageEmoji = (pct) =>
    pct === 100 ? "✅" : pct > 80 ? "🟡" : pct > 50 ? "🟠" : "❌";

  markdown += `| 📝 Lines | ${total.lines.covered} | ${total.lines.total} | ${getCoverageEmoji(total.lines.pct)} ${total.lines.pct}% |\n`;
  markdown += `| 📄 Statements | ${total.statements.covered} | ${total.statements.total} | ${getCoverageEmoji(total.statements.pct)} ${total.statements.pct}% |\n`;
  markdown += `| ⚡ Functions | ${total.functions.covered} | ${total.functions.total} | ${getCoverageEmoji(total.functions.pct)} ${total.functions.pct}% |\n`;
  markdown += `| 🔀 Branches | ${total.branches.covered} | ${total.branches.total} | ${getCoverageEmoji(total.branches.pct)} ${total.branches.pct}% |\n\n`;

  markdown += "### Coverage Legend\n\n";
  markdown += "- ✅ 100% Coverage\n";
  markdown += "- 🟡 80-99% Coverage\n";
  markdown += "- 🟠 50-79% Coverage\n";
  markdown += "- ❌ 0-49% Coverage\n\n";

  // Add file coverage section
  markdown += "## 📁 File Coverage\n\n";
  markdown += "<details>\n<summary>📋 Detailed Coverage Report</summary>\n\n";
  markdown += "| File | Lines | Statements | Functions | Branches |\n";
  markdown += "|------|-------|------------|-----------|----------|\n";

  // Process each file (excluding the total)
  Object.entries(coverageData)
    .filter(([key]) => key !== "total")
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([file, metrics]) => {
      // Convert absolute path to relative path from repo root
      const repoPath = file.split("/zkOS-monorepo/")[1];
      // Add status emoji based on line coverage
      const coverageEmoji = getCoverageEmoji(metrics.lines.pct);

      markdown += `| ${coverageEmoji} [${repoPath}](${repoPath}) | ${metrics.lines.pct}% | ${metrics.statements.pct}% | ${metrics.functions.pct}% | ${metrics.branches.pct}% |\n`;
    });

  markdown += "\n</details>\n";

  // Write the markdown file
  const outputPath = path.join(process.cwd(), "coverage", "coverage-report.md");
  fs.writeFileSync(outputPath, markdown);
  console.log(`Coverage report generated at: ${outputPath}`);
}

generateCoverageReport();
