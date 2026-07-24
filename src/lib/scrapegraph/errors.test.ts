import { describe, expect, it } from "vitest";
import { errorTypeForStatus, messageForType, normalizeError } from "./errors";

describe("errorTypeForStatus", () => {
  it.each([
    [400, "validation"],
    [401, "authentication"],
    [402, "payment_required"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limit"],
    [500, "server_error"],
    [503, "server_error"],
  ] as const)("maps HTTP %i to %s", (status, expected) => {
    expect(errorTypeForStatus(status)).toBe(expected);
  });
});

describe("normalizeError", () => {
  it("produces a Portuguese message for the mapped type", () => {
    const error = normalizeError(402);
    expect(error.type).toBe("payment_required");
    expect(error.message).toBe(messageForType("payment_required"));
  });

  it("keeps a safe original message", () => {
    const error = normalizeError(400, "Missing field: url");
    expect(error.originalMessage).toBe("Missing field: url");
  });

  it("strips original messages that look like they leak secrets", () => {
    const error = normalizeError(401, "Invalid SGAI-APIKEY provided");
    expect(error.originalMessage).toBeUndefined();
  });

  it("allows overriding the error type explicitly", () => {
    const error = normalizeError(500, undefined, undefined, "configuration");
    expect(error.type).toBe("configuration");
    expect(error.message).toContain("SGAI_API_KEY");
  });
});
