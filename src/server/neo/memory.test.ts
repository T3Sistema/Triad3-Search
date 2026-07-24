import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/neo/client", () => ({ callNeoResponses: vi.fn() }));

import { callNeoResponses } from "@/server/neo/client";
import { generateConversationTitle, refreshConversationSummary } from "@/server/neo/memory";

type FakeResponse = Awaited<ReturnType<typeof callNeoResponses>>;

function fakeTextResponse(outputText: string, usage = { input_tokens: 1, output_tokens: 1 }): FakeResponse {
  return { usage, output_text: outputText } as unknown as FakeResponse;
}

describe("generateConversationTitle", () => {
  beforeEach(() => vi.mocked(callNeoResponses).mockReset());

  it("returns the model-generated title when structured output succeeds", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse(JSON.stringify({ titulo: "Investigação sobre Empresa X" })));
    const titulo = await generateConversationTitle("Quero saber tudo sobre a Empresa X");
    expect(titulo).toBe("Investigação sobre Empresa X");
  });

  it("falls back to a truncated version of the first message when the model call fails", async () => {
    vi.mocked(callNeoResponses).mockImplementationOnce(() => Promise.reject(new Error("fail")));
    const longMessage = "a".repeat(100);
    const titulo = await generateConversationTitle(longMessage);
    expect(titulo.length).toBeLessThanOrEqual(60);
    expect(titulo.startsWith("a")).toBe(true);
  });

  it("falls back to 'Nova conversa' for an empty message when the model returns nothing usable", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse(""));
    const titulo = await generateConversationTitle("   ");
    expect(titulo).toBe("Nova conversa");
  });
});

describe("refreshConversationSummary", () => {
  beforeEach(() => vi.mocked(callNeoResponses).mockReset());

  it("returns the refreshed summary on success", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse(JSON.stringify({ resumo: "Resumo atualizado." })));
    const resumo = await refreshConversationSummary({ resumoAnterior: null, mensagens: [{ papel: "usuario", conteudo: "oi" }] });
    expect(resumo).toBe("Resumo atualizado.");
  });

  it("keeps the previous summary if the refresh call fails, never discarding known context", async () => {
    vi.mocked(callNeoResponses).mockImplementationOnce(() => Promise.reject(new Error("fail")));
    const resumo = await refreshConversationSummary({ resumoAnterior: "Resumo anterior.", mensagens: [{ papel: "usuario", conteudo: "oi" }] });
    expect(resumo).toBe("Resumo anterior.");
  });

  it("uses the same NEO_MODEL as every other Neo call", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse(JSON.stringify({ resumo: "x" })));
    await refreshConversationSummary({ resumoAnterior: null, mensagens: [{ papel: "usuario", conteudo: "oi" }] });
    const call = vi.mocked(callNeoResponses).mock.calls[0]![0];
    expect(call.model).toBe("gpt-5.4-mini");
    expect(call.store).toBe(false);
  });
});
