import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NEO_MODEL } from "./model";

const modelSourcePath = join(dirname(fileURLToPath(import.meta.url)), "model.ts");
const source = readFileSync(modelSourcePath, "utf8");

describe("NEO_MODEL", () => {
  it("is exactly gpt-5.4-mini", () => {
    expect(NEO_MODEL).toBe("gpt-5.4-mini");
  });

  it("is never derived from an environment variable, request payload, or config", () => {
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("NEXT_PUBLIC_");
  });

  it("is declared as a readonly literal constant", () => {
    expect(source).toContain('export const NEO_MODEL = "gpt-5.4-mini" as const');
  });
});
