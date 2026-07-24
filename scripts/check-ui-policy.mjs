#!/usr/bin/env node
// Fails the build/CI with a clear file:line message when a forbidden vendor
// identifier (scripts/ui-policy.config.mjs) shows up somewhere the browser
// can see it. Run in two modes:
//   node scripts/check-ui-policy.mjs           -> scans frontend source
//   node scripts/check-ui-policy.mjs --static  -> scans the built .next/static bundle
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  excludedFileNames,
  excludedPathFragments,
  forbiddenFrontendTerms,
  scannedSourceExtensions,
  staticBundleDir,
} from "./ui-policy.config.mjs";

const repoRoot = process.cwd();
const isStaticMode = process.argv.includes("--static");

const SOURCE_ROOTS = ["src/app", "src/components", "src/features", "src/lib/ui", "public"];
// "Arquivos com use client" must be scanned regardless of location, per policy.
const USE_CLIENT_SCAN_ROOT = "src";

function isExcludedPath(relPath) {
  const normalized = relPath.replaceAll("\\", "/");
  return excludedPathFragments.some((fragment) => normalized.includes(fragment));
}

function isExcludedFile(fileName) {
  return excludedFileNames.includes(fileName);
}

function walk(dir, visit) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // directory doesn't exist yet — fine, nothing to scan.
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(repoRoot, fullPath);
    if (isExcludedPath(relPath)) continue;
    if (entry.isDirectory()) {
      walk(fullPath, visit);
    } else if (entry.isFile()) {
      if (isExcludedFile(entry.name)) continue;
      visit(fullPath, relPath);
    }
  }
}

function collectSourceFiles() {
  /** @type {Map<string, string>} relPath -> absPath, de-duplicated */
  const files = new Map();

  for (const root of SOURCE_ROOTS) {
    walk(join(repoRoot, root), (fullPath, relPath) => {
      const ext = "." + fullPath.split(".").pop();
      if (!scannedSourceExtensions.includes(ext)) return;
      files.set(relPath, fullPath);
    });
  }

  // Any "use client" file anywhere under src/, even outside the roots above.
  walk(join(repoRoot, USE_CLIENT_SCAN_ROOT), (fullPath, relPath) => {
    if (!fullPath.endsWith(".ts") && !fullPath.endsWith(".tsx")) return;
    if (files.has(relPath)) return;
    let head = "";
    try {
      head = readFileSync(fullPath, "utf8").slice(0, 200);
    } catch {
      return;
    }
    if (/^\s*["']use client["']/.test(head)) {
      files.set(relPath, fullPath);
    }
  });

  return files;
}

function collectStaticFiles() {
  const files = new Map();
  walk(join(repoRoot, staticBundleDir), (fullPath, relPath) => {
    files.set(relPath, fullPath);
  });
  return files;
}

function findViolations(files) {
  const violations = [];
  const lowerTerms = forbiddenFrontendTerms.map((term) => term.toLowerCase());

  for (const [relPath, fullPath] of files) {
    let content;
    try {
      content = readFileSync(fullPath, "utf8");
    } catch {
      continue; // binary or unreadable — skip.
    }
    const lowerContent = content.toLowerCase();

    for (let i = 0; i < lowerTerms.length; i++) {
      const term = lowerTerms[i];
      let searchFrom = 0;
      let index;
      while ((index = lowerContent.indexOf(term, searchFrom)) !== -1) {
        const upToMatch = content.slice(0, index);
        const line = upToMatch.split("\n").length;
        const column = index - upToMatch.lastIndexOf("\n");
        violations.push({
          file: relPath,
          line,
          column,
          term: forbiddenFrontendTerms[i],
        });
        searchFrom = index + term.length;
      }
    }
  }

  return violations;
}

function main() {
  const files = isStaticMode ? collectStaticFiles() : collectSourceFiles();
  const violations = findViolations(files);

  if (violations.length > 0) {
    console.error(`\n✖ Política de identidade neutra violada (${isStaticMode ? "bundle estático" : "código-fonte"}):\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}:${v.column} — termo proibido "${v.term}"`);
    }
    console.error(
      `\nNenhum identificador de fornecedor pode aparecer no frontend do Triad3 Search. Veja` +
        ` .claude/rules/frontend-product-rules.md e scripts/ui-policy.config.mjs.\n`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `✓ Política de identidade neutra ok — nenhum termo proibido encontrado (${isStaticMode ? "bundle estático" : "código-fonte"}, ${files.size} arquivo(s) verificado(s)).`,
  );
}

main();
