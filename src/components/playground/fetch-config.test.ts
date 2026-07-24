import { describe, expect, it } from "vitest";
import { DEFAULT_FETCH_CONFIG_FORM, toFetchConfigPayload } from "./fetch-config";

describe("toFetchConfigPayload", () => {
  it("drops empty/default fields", () => {
    const payload = toFetchConfigPayload(DEFAULT_FETCH_CONFIG_FORM);
    expect(payload?.stealth).toBeUndefined();
    expect(payload?.headers).toBeUndefined();
    expect(payload?.cookies).toBeUndefined();
    expect(payload?.scrolls).toBeUndefined();
    expect(payload?.wait).toBeUndefined();
    expect(payload?.country).toBeUndefined();
    expect(payload?.mode).toBe("auto");
    expect(payload?.timeout).toBe(30000);
  });

  it("parses headers/cookies JSON text into objects", () => {
    const payload = toFetchConfigPayload({
      ...DEFAULT_FETCH_CONFIG_FORM,
      headersRaw: '{"X-Test": "1"}',
      cookiesRaw: '{"session": "abc"}',
    });
    expect(payload?.headers).toEqual({ "X-Test": "1" });
    expect(payload?.cookies).toEqual({ session: "abc" });
  });

  it("ignores invalid JSON for headers/cookies", () => {
    const payload = toFetchConfigPayload({ ...DEFAULT_FETCH_CONFIG_FORM, headersRaw: "{not json}" });
    expect(payload?.headers).toBeUndefined();
  });

  it("lowercases the country code", () => {
    const payload = toFetchConfigPayload({ ...DEFAULT_FETCH_CONFIG_FORM, country: "BR" });
    expect(payload?.country).toBe("br");
  });

  it("keeps scrolls/wait only when greater than zero", () => {
    const payload = toFetchConfigPayload({ ...DEFAULT_FETCH_CONFIG_FORM, scrolls: 3, wait: 500 });
    expect(payload?.scrolls).toBe(3);
    expect(payload?.wait).toBe(500);
  });
});
