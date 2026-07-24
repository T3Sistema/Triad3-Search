import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/neo/client", () => ({ callNeoResponses: vi.fn() }));

import { callNeoResponses } from "@/server/neo/client";
import { synthesizeAnswer, assignFonteIds } from "@/server/neo/synthesizer";
import { baseNeoAnswer } from "@/lib/neo/answer-fixtures";

type FakeResponse = Awaited<ReturnType<typeof callNeoResponses>>;

function fakeTextResponse(outputText: string, usage = { input_tokens: 10, output_tokens: 20 }): FakeResponse {
  return { usage, output_text: outputText } as unknown as FakeResponse;
}

function validAnswerJson() {
  return JSON.stringify(baseNeoAnswer({ titulo: "Relatório", respostaDireta: "Resumo." }));
}

const input = {
  userMessage: "pergunta",
  plan: null,
  evidence: [],
  fontesColetadas: [{ url: "https://a.com", titulo: "A", dominio: "a.com" }],
};

beforeEach(() => vi.mocked(callNeoResponses).mockReset());

describe("assignFonteIds", () => {
  // Kept async (even though the function under test is sync): a plain sync `it`
  // ahead of an async-rejection test in this file, combined with the shared
  // `beforeEach`, trips a Vitest task-scheduling quirk that misattributes the
  // later test's handled rejection as unhandled.
  it("assigns stable, sequential ids only from collected sources — never fabricated", async () => {
    const fontes = assignFonteIds([{ url: "https://a.com" }, { url: "https://b.com" }]);
    expect(fontes.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(fontes.map((f) => f.url)).toEqual(["https://a.com", "https://b.com"]);
  });
});

describe("synthesizeAnswer — Structured Output válido", () => {
  it("returns the parsed answer on the first successful attempt without retrying", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse(validAnswerJson()));
    const result = await synthesizeAnswer(input);
    expect(result.validationFailed).toBe(false);
    expect(result.answer.titulo).toBe("Relatório");
    expect(callNeoResponses).toHaveBeenCalledTimes(1);
  });
});

describe("synthesizeAnswer — Structured Output inválido e recuperação controlada", () => {
  it("retries exactly once on invalid JSON, succeeding on the second attempt", async () => {
    vi.mocked(callNeoResponses)
      .mockResolvedValueOnce(fakeTextResponse("isto não é json"))
      .mockResolvedValueOnce(fakeTextResponse(validAnswerJson()));
    const result = await synthesizeAnswer(input);
    expect(callNeoResponses).toHaveBeenCalledTimes(2);
    expect(result.validationFailed).toBe(false);
    expect(result.answer.titulo).toBe("Relatório");
  });

  it("falls back to a safe textual answer after two consecutive invalid attempts — never surfaces raw JSON", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse("{ bad json")).mockResolvedValueOnce(fakeTextResponse("still bad"));
    const result = await synthesizeAnswer(input);
    expect(callNeoResponses).toHaveBeenCalledTimes(2);
    expect(result.validationFailed).toBe(true);
    expect(result.answer.status).toBe("parcial");
    expect(result.answer.blocos[0]).toMatchObject({ tipo: "texto" });
  });

  it("rejects an answer missing required fields even if it is syntactically valid JSON", async () => {
    vi.mocked(callNeoResponses)
      .mockResolvedValueOnce(fakeTextResponse(JSON.stringify({ titulo: "sem os outros campos" }), { input_tokens: 1, output_tokens: 1 }))
      .mockResolvedValueOnce(fakeTextResponse(JSON.stringify({ titulo: "ainda incompleto" }), { input_tokens: 1, output_tokens: 1 }));
    const result = await synthesizeAnswer(input);
    expect(result.validationFailed).toBe(true);
  });
});

// The "falha na chamada ao modelo" scenario (LLM call rejects outright) lives in its
// own file, synthesizer.provider-failure.test.ts — this repo's installed Vitest
// (v4.1.10) misattributes that test's own handled rejection as unhandled when it
// shares a file with several preceding tests, even though the underlying
// synthesizeAnswer try/catch behavior is correct in isolation (verified directly).
