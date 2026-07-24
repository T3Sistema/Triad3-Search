import { describe, expect, it } from "vitest";
import { sanitizeInternalPath } from "./redirect-target";

describe("sanitizeInternalPath", () => {
  it("accepts a plain internal path", () => {
    expect(sanitizeInternalPath("/extract")).toBe("/extract");
    expect(sanitizeInternalPath("/mapear/123")).toBe("/mapear/123");
    expect(sanitizeInternalPath("/")).toBe("/");
  });

  it("falls back to the default for null/undefined/empty input", () => {
    expect(sanitizeInternalPath(null)).toBe("/");
    expect(sanitizeInternalPath(undefined)).toBe("/");
    expect(sanitizeInternalPath("")).toBe("/");
    expect(sanitizeInternalPath(null, "/custom")).toBe("/custom");
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    expect(sanitizeInternalPath("//evil.com")).toBe("/");
    expect(sanitizeInternalPath("///evil.com")).toBe("/");
  });

  it("rejects absolute external URLs", () => {
    expect(sanitizeInternalPath("https://evil.com")).toBe("/");
    expect(sanitizeInternalPath("http://evil.com/path")).toBe("/");
  });

  it("rejects paths without a leading slash", () => {
    expect(sanitizeInternalPath("extract")).toBe("/");
    expect(sanitizeInternalPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects a backslash trick that browsers may normalize to //", () => {
    expect(sanitizeInternalPath("/\\evil.com")).toBe("/");
    expect(sanitizeInternalPath("/\\/evil.com")).toBe("/");
  });

  it("rejects control characters", () => {
    expect(sanitizeInternalPath("/foo\tbar")).toBe("/");
    expect(sanitizeInternalPath("/foo\nbar")).toBe("/");
  });

  it("rejects a percent-encoded protocol-relative URL after decoding", () => {
    expect(sanitizeInternalPath("/%2F%2Fevil.com")).toBe("/");
  });

  it("falls back on malformed percent-encoding instead of throwing", () => {
    expect(sanitizeInternalPath("/%")).toBe("/");
  });

  it("rejects an overly long value", () => {
    expect(sanitizeInternalPath("/" + "a".repeat(1000))).toBe("/");
  });
});
