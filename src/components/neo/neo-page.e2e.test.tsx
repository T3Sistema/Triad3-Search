// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NeoPage } from "./neo-page";
import { NEO_ANSWER_VERSION } from "@/lib/neo/answer";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

function sseFrame(evento: unknown): string {
  return `data: ${JSON.stringify(evento)}\n\n`;
}

function streamResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderNeoPage(conversaId = "c1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NeoPage conversaId={conversaId} />
    </QueryClientProvider>,
  );
}

const respostaFinal = {
  version: NEO_ANSWER_VERSION,
  status: "completo" as const,
  titulo: "Perfil da Empresa X",
  resumoExecutivo: "Resumo da investigação.",
  blocos: [
    { tipo: "fatos" as const, titulo: "Fatos", itens: [{ rotulo: "Site", valor: "empresa.com", tipo: null, nivelEvidencia: "confirmado" as const, dataObservacao: "2026-01-01", fontesIds: ["f1"] }] },
  ],
  fontes: [{ id: "f1", titulo: "Site oficial", url: "https://empresa.com", dominio: "empresa.com", dataAcesso: "2026-01-01" }],
  informacoesAusentes: [],
  observacoes: [],
  proximasAcoes: [],
  perguntaNecessaria: null,
};

describe("Neo — fluxo completo mockado (planejamento, etapas, relatório)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    push.mockClear();
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.includes("/conversas/c1") && !url.includes("mensagens") && !url.includes("executar") && method === "GET") {
        return jsonResponse(200, { id: "c1", usuarioId: "u1", titulo: "Conversa de teste", resumoContexto: null, status: "ativa", criadoEm: "t", atualizadoEm: "t" });
      }
      if (url.includes("/conversas?") && method === "GET") {
        return jsonResponse(200, { data: [] });
      }
      if (url.includes("/mensagens") && method === "GET") {
        return jsonResponse(200, { data: [] });
      }
      if (url.includes("/executar") && method === "POST") {
        return streamResponse([
          sseFrame({ tipo: "execucao.iniciada", execucaoId: "e1", mensagemId: "m1" }),
          sseFrame({ tipo: "plano.pronto", objetivo: "Reunir um panorama da Empresa X", etapasPrevistas: ["Localizar site oficial"] }),
          sseFrame({ tipo: "etapa.iniciada", etapaId: "et1", ordem: 1, nomePublico: "Pesquisando fontes" }),
          sseFrame({ tipo: "etapa.concluida", etapaId: "et1", ordem: 1, nomePublico: "Pesquisando fontes", resumo: "1 fonte encontrada." }),
          sseFrame({ tipo: "resposta.concluida", mensagemId: "m1", resposta: respostaFinal }),
        ]);
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the empty conversation state, then streams plan → steps → structured report as the user sends a message", async () => {
    renderNeoPage();

    await screen.findByText("Envie uma mensagem para começar esta investigação.");

    const textarea = screen.getByRole("textbox", { name: "Mensagem para o Neo" });
    fireEvent.change(textarea, { target: { value: "Reúna um panorama da Empresa X" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    // Progress panel: objective + step lifecycle.
    await screen.findByText("Reunir um panorama da Empresa X");
    await screen.findByText("Pesquisando fontes");
    await waitFor(() => expect(screen.getByText("1 fonte encontrada.")).toBeInTheDocument());

    // Final structured report — never raw JSON, always through AnswerView.
    await screen.findByText("Perfil da Empresa X");
    expect(screen.getByText("Site")).toBeInTheDocument();
    expect(screen.getByText("empresa.com")).toBeInTheDocument();
    expect(screen.queryByText(/"tipo":"fatos"/)).not.toBeInTheDocument();

    // Sources drawer.
    const fontesButton = screen.getByRole("button", { name: /Todas as fontes/ });
    fireEvent.click(fontesButton);
    expect(within(fontesButton.closest("div")!.parentElement!).getByText("Site oficial")).toBeInTheDocument();
  });

  it("shows a confirmation card and posts to /confirmar only a yes/no when the user approves a persistent action", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url.includes("/conversas/c1") && method === "GET" && !url.includes("mensagens")) {
        return jsonResponse(200, { id: "c1", usuarioId: "u1", titulo: "Conversa", resumoContexto: null, status: "ativa", criadoEm: "t", atualizadoEm: "t" });
      }
      if (url.includes("/mensagens") && method === "GET") return jsonResponse(200, { data: [] });
      if (url.includes("/executar") && method === "POST") {
        return streamResponse([
          sseFrame({ tipo: "execucao.iniciada", execucaoId: "e1", mensagemId: "m1" }),
          sseFrame({ tipo: "plano.pronto", objetivo: "Configurar monitoramento", etapasPrevistas: [] }),
          sseFrame({
            tipo: "confirmacao.necessaria",
            execucaoId: "e1",
            etapaId: "etc1",
            nomePublico: "monitor_criar",
            descricao: 'Criar um monitoramento para "https://empresa.com".',
          }),
        ]);
      }
      if (url.includes("/execucoes/e1/confirmar") && method === "POST") {
        const body = JSON.parse((init?.body as string) ?? "{}");
        expect(Object.keys(body)).toEqual(["confirmar"]);
        return streamResponse([sseFrame({ tipo: "resposta.concluida", mensagemId: "m1", resposta: { ...respostaFinal, titulo: "Monitoramento criado" } })]);
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });

    renderNeoPage();
    const textarea = await screen.findByRole("textbox", { name: "Mensagem para o Neo" });
    fireEvent.change(textarea, { target: { value: "Crie um monitoramento para https://empresa.com" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await screen.findByText("Confirmação necessária");
    expect(screen.getByText('Criar um monitoramento para "https://empresa.com".')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await screen.findByText("Monitoramento criado");
  });

  it("stops the execution when the user clicks Parar, aborting the client stream and calling the cancel endpoint", async () => {
    let resolveEtapa: (() => void) | null = null;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url.includes("/conversas/c1") && method === "GET" && !url.includes("mensagens")) {
        return jsonResponse(200, { id: "c1", usuarioId: "u1", titulo: "Conversa", resumoContexto: null, status: "ativa", criadoEm: "t", atualizadoEm: "t" });
      }
      if (url.includes("/mensagens") && method === "GET") return jsonResponse(200, { data: [] });
      if (url.includes("/execucoes/e1/cancelar") && method === "POST") {
        return jsonResponse(200, { ok: true, jaFinalizada: false });
      }
      if (url.includes("/executar") && method === "POST") {
        const signal = init?.signal;
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(sseFrame({ tipo: "execucao.iniciada", execucaoId: "e1", mensagemId: "m1" })));
            controller.enqueue(encoder.encode(sseFrame({ tipo: "plano.pronto", objetivo: "Investigando", etapasPrevistas: [] })));
            controller.enqueue(encoder.encode(sseFrame({ tipo: "etapa.iniciada", etapaId: "et1", ordem: 1, nomePublico: "Pesquisando" })));
            resolveEtapa = () => controller.close();
            signal?.addEventListener("abort", () => {
              try {
                controller.error(new DOMException("aborted", "AbortError"));
              } catch {
                // already closed
              }
            });
          },
        });
        return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });

    renderNeoPage();
    const textarea = await screen.findByRole("textbox", { name: "Mensagem para o Neo" });
    fireEvent.change(textarea, { target: { value: "investigar algo" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    const pararButton = await screen.findByRole("button", { name: "Parar execução" });
    fireEvent.click(pararButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/execucoes/e1/cancelar"), expect.objectContaining({ method: "POST" })));
    void resolveEtapa;
  });
});
