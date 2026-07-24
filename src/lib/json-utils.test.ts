import { describe, expect, it } from "vitest";
import { formatJson, validateJson } from "./json-utils";

describe("validateJson", () => {
  it("treats an empty string as valid with no value", () => {
    const result = validateJson("   ");
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toBeUndefined();
  });

  it("parses valid JSON", () => {
    const result = validateJson('{"a": 1}');
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value).toEqual({ a: 1 });
  });

  it("reports invalid JSON with a message", () => {
    const result = validateJson("{a: 1}");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.message).toBeTruthy();
  });
});

describe("formatJson", () => {
  it("pretty-prints valid JSON", () => {
    expect(formatJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it("returns the original string when invalid", () => {
    expect(formatJson("not json")).toBe("not json");
  });
});
