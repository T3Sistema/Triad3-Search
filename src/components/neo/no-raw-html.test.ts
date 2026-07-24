import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const NEO_COMPONENTS_DIR = join(__dirname);

function collectTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

describe("Neo frontend components never bypass React's sanitized rendering", () => {
  it("contains no dangerouslySetInnerHTML anywhere under src/components/neo", () => {
    const files = collectTsxFiles(NEO_COMPONENTS_DIR);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toContain("dangerouslySetInnerHTML");
    }
  });

  it("never renders raw JSON (JSON.stringify piped straight into JSX text) as the primary UI", () => {
    const files = collectTsxFiles(NEO_COMPONENTS_DIR);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      // Heuristic: JSON.stringify should never appear directly inside a JSX
      // expression container in these components — structured data always
      // goes through a named renderer (answer-blocks.tsx), never straight to text.
      expect(content).not.toMatch(/\{JSON\.stringify\(/);
    }
  });
});
