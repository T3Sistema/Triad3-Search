import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(scriptDir, "check-ui-policy.mjs");
const repoRoot = join(scriptDir, "..");

describe("check-ui-policy.mjs (source mode)", () => {
  it("passes against the current frontend source tree", () => {
    expect(() => execFileSync("node", [scriptPath], { cwd: repoRoot, stdio: "pipe" })).not.toThrow();
  });
});
