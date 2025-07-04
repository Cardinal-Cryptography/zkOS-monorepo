import * as fs from "fs";
import * as path from "path";

// Configuration
const basePatterns = ['from "shielder_bindings/web-singlethreaded"'];
const targetPaths = [
  "crates/shielder_bindings/pkg-without-circuits/pkg-web-singlethreaded/shielder_bindings.js"
];

function getRelativePath(fromPath, toPath) {
  // Get the relative directory depth from the source file to the project root
  const relativeToRoot = path.relative(path.dirname(fromPath), process.cwd());
  // Count how many levels up we need to go
  const upLevels = relativeToRoot
    .split(path.sep)
    .filter((x) => x === "..").length;
  // Add extra "../" based on the current file's depth
  const prefix = "../".repeat(upLevels - 1);
  // If the target path is in the same directory, return "./"
  if (prefix === "") {
    return "./" + toPath;
  }
  return prefix + toPath;
}

function updateImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let wasModified = false;

    for (let i = 0; i < basePatterns.length; i++) {
      if (content.includes(basePatterns[i])) {
        const relativePath = getRelativePath(filePath, targetPaths[i]);
        content = content.replace(
          new RegExp(basePatterns[i], "g"),
          `from "${relativePath}"`
        );
        wasModified = true;
      }
    }
    if (wasModified) {
      fs.writeFileSync(filePath, content);
      console.log(`Updated imports in: ${filePath}`);
      // Log the relative paths for verification
      console.log(`  Relative paths for this file:`);
      targetPaths.forEach((targetPath) => {
        console.log(`  - ${getRelativePath(filePath, targetPath)}`);
      });
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

function walkDirectory(dir, fileTypes = [".js", ".jsx", ".ts", ".tsx"]) {
  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);

    for (const file of files) {
      const filePath = path.join(currentDir, file);
      // Skip symlinks
      if (fs.lstatSync(filePath).isSymbolicLink()) {
        console.log(`Skipping symlink: ${filePath}`);
        continue;
      }
      const stat = fs.statSync(filePath);
      if (stat.isDirectory() && !file.includes("node_modules")) {
        walk(filePath);
      } else if (stat.isFile() && fileTypes.includes(path.extname(file))) {
        updateImports(filePath);
      }
    }
  }

  walk(dir);
}

// Usage example
const startDir = "./dist";
walkDirectory(startDir);
