#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function generateCoverageReport() {
  // Read the coverage summary JSON
  const coverageData = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "coverage", "coverage-final.json"),
      "utf8"
    )
  );

  // Calculate total coverage metrics
  const total = {
    lines: { total: 0, covered: 0, pct: 0 },
    statements: { total: 0, covered: 0, pct: 0 },
    functions: { total: 0, covered: 0, pct: 0 },
    branches: { total: 0, covered: 0, pct: 0 }
  };

  // Process each file's coverage data
  const fileMetrics = {};
  Object.entries(coverageData).forEach(([file, data]) => {
    const metrics = {
      lines: { total: 0, covered: 0, pct: 0 },
      statements: { total: 0, covered: 0, pct: 0 },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 }
    };

    // Calculate statement coverage
    const statementTotal = Object.keys(data.statementMap).length;
    const statementCovered = Object.values(data.s).filter(
      (count) => count > 0
    ).length;
    metrics.statements = {
      total: statementTotal,
      covered: statementCovered,
      pct: statementTotal
        ? Math.round((statementCovered / statementTotal) * 100)
        : 100
    };

    // Calculate branch coverage
    const branchTotal = Object.keys(data.branchMap).length * 2; // Each branch has 2 paths
    const branchCovered = Object.values(data.b)
      .flat()
      .filter((count) => count > 0).length;
    metrics.branches = {
      total: branchTotal,
      covered: branchCovered,
      pct: branchTotal ? Math.round((branchCovered / branchTotal) * 100) : 100
    };

    // Calculate function coverage
    const functionTotal = Object.keys(data.fnMap).length;
    const functionCovered = Object.values(data.f).filter(
      (count) => count > 0
    ).length;
    metrics.functions = {
      total: functionTotal,
      covered: functionCovered,
      pct: functionTotal
        ? Math.round((functionCovered / functionTotal) * 100)
        : 100
    };

    // Calculate line coverage
    const lines = new Set();
    const coveredLines = new Set();
    Object.values(data.statementMap).forEach((loc) => {
      for (let i = loc.start.line; i <= loc.end.line; i++) {
        lines.add(i);
      }
    });
    Object.entries(data.s).forEach(([id, count]) => {
      if (count > 0) {
        const loc = data.statementMap[id];
        for (let i = loc.start.line; i <= loc.end.line; i++) {
          coveredLines.add(i);
        }
      }
    });
    metrics.lines = {
      total: lines.size,
      covered: coveredLines.size,
      pct: lines.size ? Math.round((coveredLines.size / lines.size) * 100) : 100
    };

    fileMetrics[file] = metrics;

    // Add to totals
    total.statements.total += metrics.statements.total;
    total.statements.covered += metrics.statements.covered;
    total.branches.total += metrics.branches.total;
    total.branches.covered += metrics.branches.covered;
    total.functions.total += metrics.functions.total;
    total.functions.covered += metrics.functions.covered;
    total.lines.total += metrics.lines.total;
    total.lines.covered += metrics.lines.covered;
  });

  // Calculate total percentages
  total.statements.pct = total.statements.total
    ? Math.round((total.statements.covered / total.statements.total) * 100)
    : 100;
  total.branches.pct = total.branches.total
    ? Math.round((total.branches.covered / total.branches.total) * 100)
    : 100;
  total.functions.pct = total.functions.total
    ? Math.round((total.functions.covered / total.functions.total) * 100)
    : 100;
  total.lines.pct = total.lines.total
    ? Math.round((total.lines.covered / total.lines.total) * 100)
    : 100;

  let markdown = "# 📊 Coverage Report\n\n";

  // Add total coverage section
  markdown += "## 📈 Total Coverage Summary\n\n";
  markdown += "| Type | Covered | Total | Coverage |\n";
  markdown += "|------|---------|--------|----------|\n";

  // Generate markdown with coverage metrics
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
  Object.entries(fileMetrics)
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
