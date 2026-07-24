import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/neo/client", () => ({ callNeoResponses: vi.fn() }));

import { callNeoResponses } from "@/server/neo/client";
import { synthesizeAnswer } from "@/server/neo/synthesizer";

// Kept in its own file: see the note in synthesizer.test.ts next to where this
// scenario used to live.
describe("synthesizeAnswer — falha na chamada ao modelo", () => {
  it("returns a safe fallback answer if the LLM call itself throws, never crashing the caller", async () => {
    vi.mocked(callNeoResponses).mockRejectedValue(new Error("network down"));
    const result = await synthesizeAnswer({ userMessage: "pergunta", plan: null, evidence: [], fontesColetadas: [] });
    expect(result.validationFailed).toBe(true);
    expect(result.answer.status).toBe("nao_concluido");
  });
});
