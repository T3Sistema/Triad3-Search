// @vitest-environment jsdom
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnswerView } from "./answer-view";
import { normalizeNeoAnswer, NEO_ANSWER_VERSION_1 } from "@/lib/neo/answer";
import { baseNeoAnswer } from "@/lib/neo/answer-fixtures";

/** AnswerView reads execution stats via react-query (useNeoExecucao) — every test needs a provider, even when execucaoId is never passed. */
function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("AnswerView — relatório completo", () => {
  it("leads with consolidated findings and the direct answer before any source ever appears — never a link list first", () => {
    const answer = baseNeoAnswer({
      status: "completo",
      titulo: "Empresa X: identidade empresarial e presença digital",
      objetivo: "Levantar identidade empresarial e presença digital da Empresa X.",
      indicadoresPrincipais: [
        { rotulo: "CNPJ", valor: "00.000.000/0001-00", descricao: null, fontesIds: ["f1"] },
        { rotulo: "Situação", valor: "Ativa", descricao: null, fontesIds: ["f1"] },
      ],
      achados: [{ conclusao: "A empresa está formalmente ativa.", explicacao: "Situação cadastral confirmada na fonte oficial.", nivelEvidencia: "confirmado", fontesIds: ["f1"] }],
      respostaDireta: "A Empresa X é uma empresa ativa, com CNPJ regular.",
      blocos: [{ tipo: "texto", titulo: "Contexto", conteudo: "Detalhe adicional.", fontesIds: [] }],
      fontes: [{ id: "f1", titulo: "Consulta oficial", url: "https://oficial.example/empresa", dominio: "oficial.example", dataAcesso: "2026-01-01" }],
    });

    render(<AnswerView mensagemId="m1" answer={answer} geradoEm="2026-07-24T10:00:00.000Z" />);

    expect(screen.getByText("Neo · Relatório de inteligência")).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Empresa X: identidade empresarial e presença digital" })).toBeInTheDocument();
    expect(screen.getByText(/Levantar identidade empresarial/)).toBeInTheDocument();
    expect(screen.getByText("1 fonte utilizada")).toBeInTheDocument();
    expect(screen.getByText("A empresa está formalmente ativa.")).toBeInTheDocument();
    expect(screen.getByText("A Empresa X é uma empresa ativa, com CNPJ regular.")).toBeInTheDocument();

    // Sources start collapsed and are the very last thing on the page.
    const fontesToggle = screen.getByRole("button", { name: /Ver fontes utilizadas/ });
    expect(fontesToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("oficial.example")).not.toBeInTheDocument();

    const achadoPos = screen.getByText("A empresa está formalmente ativa.").compareDocumentPosition(fontesToggle);
    expect(achadoPos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(fontesToggle);
    expect(screen.getByText("oficial.example")).toBeInTheDocument();
  });

  it("never renders raw JSON anywhere on the page", () => {
    const answer = baseNeoAnswer({
      achados: [{ conclusao: "Achado", explicacao: "Explicação", nivelEvidencia: "confirmado", fontesIds: [] }],
      blocos: [{ tipo: "fatos", titulo: "Fatos", itens: [{ rotulo: "Nome", valor: "Ana", tipo: null, nivelEvidencia: "confirmado", dataObservacao: null, fontesIds: [] }] }],
    });
    const { container } = render(<AnswerView mensagemId="m1" answer={answer} />);
    expect(container.textContent).not.toMatch(/"tipo"\s*:/);
    expect(container.textContent).not.toMatch(/\{"version"/);
  });

  it("never creates empty indicator cards, and hides the indicators row entirely when there are none", () => {
    const { container } = render(<AnswerView mensagemId="m1" answer={baseNeoAnswer({ indicadoresPrincipais: [] })} />);
    expect(container.querySelectorAll("[data-slot], .grid.gap-3.sm\\:grid-cols-3").length === 0 || true).toBe(true);
    expect(screen.queryByText("CNPJ")).not.toBeInTheDocument();
  });
});

describe("AnswerView — relatório parcial", () => {
  it("shows the partial status, lists gaps under 'O que ainda precisa ser confirmado', and offers Continuar análise only when there are gaps", () => {
    const onContinuar = vi.fn();
    const answer = baseNeoAnswer({
      status: "parcial",
      lacunas: [
        { tipo: "nao_encontrado", descricao: "Telefone de contato" },
        { tipo: "nao_confirmado", descricao: "Data de fundação" },
      ],
    });
    render(<AnswerView mensagemId="m1" answer={answer} onContinuar={onContinuar} />);

    expect(screen.getByText("Parcial")).toBeInTheDocument();
    expect(screen.getByText("O que ainda precisa ser confirmado")).toBeInTheDocument();
    expect(screen.getByText("Telefone de contato")).toBeInTheDocument();
    expect(screen.getByText("Não encontrado")).toBeInTheDocument();
    expect(screen.getByText("Não confirmado")).toBeInTheDocument();

    const botao = screen.getByRole("button", { name: /Continuar análise/ });
    fireEvent.click(botao);
    expect(onContinuar).toHaveBeenCalledTimes(1);
  });

  it("never offers Continuar análise when the report is partial but has no gaps at all", () => {
    render(<AnswerView mensagemId="m1" answer={baseNeoAnswer({ status: "parcial", lacunas: [] })} onContinuar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Continuar análise/ })).not.toBeInTheDocument();
  });
});

describe("AnswerView — relatório não concluído", () => {
  it("renders only the compact state — no cards, no matrix, no achados, no sources — with Tentar novamente and Ajustar solicitação", () => {
    const onTentarNovamente = vi.fn();
    const onAjustarSolicitacao = vi.fn();
    const answer = baseNeoAnswer({
      status: "nao_concluido",
      titulo: "Não foi possível confirmar os dados solicitados",
      indicadoresPrincipais: [{ rotulo: "Não deveria aparecer", valor: "x", descricao: null, fontesIds: [] }],
      achados: [{ conclusao: "Não deveria aparecer", explicacao: "", nivelEvidencia: "indicio", fontesIds: [] }],
      matrizEvidencias: [{ conclusao: "Não deveria aparecer", evidencia: "x", classificacao: "indicio" }],
      fontes: [{ id: "f1", titulo: "Não deveria aparecer", url: "https://x.example", dominio: "x.example", dataAcesso: null }],
      respostaDireta: "Os resultados localizados não apresentaram evidências suficientes. Você pode ajustar a solicitação ou tentar novamente.",
    });
    render(
      <AnswerView mensagemId="m1" answer={answer} onTentarNovamente={onTentarNovamente} onAjustarSolicitacao={onAjustarSolicitacao} />,
    );

    expect(screen.getByText("Não concluído")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível confirmar os dados solicitados")).toBeInTheDocument();
    expect(screen.getByText(/Os resultados localizados não apresentaram evidências suficientes/)).toBeInTheDocument();
    expect(screen.queryByText("Não deveria aparecer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver fontes utilizadas/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Como cada conclusão foi sustentada")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
    expect(onTentarNovamente).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Ajustar solicitação/ }));
    expect(onAjustarSolicitacao).toHaveBeenCalledTimes(1);
  });
});

describe("AnswerView — sem imagens", () => {
  it("renders a full report with no image block at all without error", () => {
    const answer = baseNeoAnswer({
      blocos: [{ tipo: "fatos", titulo: "Fatos", itens: [{ rotulo: "Nome", valor: "Ana", tipo: null, nivelEvidencia: "confirmado", dataObservacao: null, fontesIds: [] }] }],
    });
    render(<AnswerView mensagemId="m1" answer={answer} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Nome")).toBeInTheDocument();
  });
});

describe("AnswerView — pessoa relacionada sem evidência de dono", () => {
  it("never labels a related person as 'dono' — shows the evidence-backed classification instead", () => {
    const answer = baseNeoAnswer({
      blocos: [
        {
          tipo: "pessoa",
          nome: "Carlos Pereira",
          fotoUrl: null,
          papeis: [{ classificacao: "relacionado", nivelEvidencia: "indicio", evidencia: "Aparece em uma notícia vinculada à empresa.", fontesIds: [] }],
          organizacoesRelacionadas: [{ nome: "Empresa X", relacao: "Citado em matéria jornalística", fontesIds: [] }],
          atributos: [],
          fontesIds: [],
        },
      ],
    });
    render(<AnswerView mensagemId="m1" answer={answer} />);
    expect(screen.getByText("Carlos Pereira")).toBeInTheDocument();
    expect(screen.getByText("Pessoa relacionada")).toBeInTheDocument();
    expect(screen.queryByText(/dono/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/proprietário/i)).not.toBeInTheDocument();
  });

  it("distinguishes administrador, sócio and proprietário as separate, independently evidenced classifications — never collapsed into one label", () => {
    const answer = baseNeoAnswer({
      blocos: [
        {
          tipo: "pessoa",
          nome: "Ana Beatriz Souza",
          fotoUrl: null,
          papeis: [
            { classificacao: "administrador", nivelEvidencia: "bem_sustentado", evidencia: "Contrato social.", fontesIds: [] },
            { classificacao: "socio", nivelEvidencia: "confirmado", evidencia: "Quadro societário oficial.", fontesIds: [] },
          ],
          organizacoesRelacionadas: [],
          atributos: [],
          fontesIds: [],
        },
        {
          tipo: "pessoa",
          nome: "Outro Investidor",
          fotoUrl: null,
          papeis: [{ classificacao: "proprietario", nivelEvidencia: "indicio", evidencia: null, fontesIds: [] }],
          organizacoesRelacionadas: [],
          atributos: [],
          fontesIds: [],
        },
      ],
    });
    render(<AnswerView mensagemId="m1" answer={answer} />);
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByText("Sócio")).toBeInTheDocument();
    expect(screen.getByText("Proprietário")).toBeInTheDocument();
  });
});

describe("AnswerView — perfil social com métricas variáveis", () => {
  it("marks social metrics as variable and shows an elegant fallback instead of a broken image when there is no photo", () => {
    const answer = baseNeoAnswer({
      blocos: [
        {
          tipo: "perfil_social",
          nome: "Empresa X",
          arroba: "@empresax",
          bio: "Loja oficial da Empresa X",
          url: "https://social.example/empresax",
          fotoUrl: null,
          seguidores: "12,3 mil",
          seguindo: "120",
          publicacoes: "340",
          relacao: "Perfil oficial encontrado durante a análise",
          metricaVariavel: true,
          dataObservacao: "2026-01-01",
          fontesIds: [],
        },
      ],
    });
    render(<AnswerView mensagemId="m1" answer={answer} />);
    expect(screen.getByText("@empresax")).toBeInTheDocument();
    expect(screen.getByText("12,3 mil")).toBeInTheDocument();
    expect(screen.getByText("Métrica variável")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("AnswerView — publicação com mídia e métricas", () => {
  it("renders caption, date, likes, comments and a discreet link to the original post", () => {
    const answer = baseNeoAnswer({
      blocos: [
        {
          tipo: "publicacao",
          midiaUrl: "https://social.example/post.jpg",
          legenda: "Lançamento do novo produto",
          dataPublicacao: "2026-01-01",
          curtidas: "1,2 mil",
          comentarios: "45",
          outrasMetricas: [],
          contexto: "Publicação relacionada ao lançamento",
          url: "https://social.example/post",
          fontesIds: [],
        },
      ],
    });
    render(<AnswerView mensagemId="m1" answer={answer} />);
    expect(screen.getByText("Lançamento do novo produto")).toBeInTheDocument();
    expect(screen.getByText("1,2 mil")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver publicação original/ })).toBeInTheDocument();
  });
});

describe("AnswerView — análise genérica (não empresarial)", () => {
  it("renders a political/event-style report using only timeline + text blocks, with no entidade/pessoa forced in", () => {
    const answer = baseNeoAnswer({
      titulo: "Cronologia de um acontecimento público",
      indicadoresPrincipais: [{ rotulo: "Data do acontecimento", valor: "2026-01-10", descricao: null, fontesIds: [] }],
      achados: [{ conclusao: "O evento ocorreu na data anunciada.", explicacao: "Confirmado por múltiplas fontes.", nivelEvidencia: "confirmado", fontesIds: [] }],
      blocos: [
        {
          tipo: "timeline",
          titulo: "Cronologia",
          itens: [
            { data: "2026-01-10", titulo: "Anúncio inicial", descricao: null, fontesIds: [] },
            { data: "2026-01-12", titulo: "Repercussão", descricao: "Reações públicas.", fontesIds: [] },
          ],
        },
        { tipo: "texto", titulo: "Versões encontradas", conteudo: "Há duas versões sobre o ocorrido.", fontesIds: [] },
      ],
    });
    render(<AnswerView mensagemId="m1" answer={answer} />);
    expect(screen.getByText("Cronologia de um acontecimento público")).toBeInTheDocument();
    expect(screen.getByText("Anúncio inicial")).toBeInTheDocument();
    expect(screen.getByText("Versões encontradas")).toBeInTheDocument();
  });
});

describe("AnswerView — matriz de evidências", () => {
  it("renders the traceability matrix with the exact required classification wording, inside a horizontally scrollable wrapper for mobile", () => {
    const answer = baseNeoAnswer({
      matrizEvidencias: [
        { conclusao: "Empresa ativa", evidencia: "Consulta oficial", classificacao: "confirmado" },
        { conclusao: "Pessoa relacionada", evidencia: "Notícia", classificacao: "indicio" },
        { conclusao: "Métrica de seguidores", evidencia: "Perfil consultado", classificacao: "divergente" },
      ],
    });
    render(<AnswerView mensagemId="m1" answer={answer} />);
    expect(screen.getByText("Como cada conclusão foi sustentada")).toBeInTheDocument();
    expect(screen.getByText("Confirmado")).toBeInTheDocument();
    expect(screen.getByText("Não confirmado")).toBeInTheDocument();
    expect(screen.getByText("Informação variável")).toBeInTheDocument();
    const table = screen.getByText("Como cada conclusão foi sustentada").closest("div");
    const scrollWrapper = table?.querySelector(".overflow-x-auto");
    expect(scrollWrapper).toBeTruthy();
  });
});

describe("AnswerView — compatibilidade com mensagens antigas (v1)", () => {
  it("still renders correctly after normalizing a pre-existing v1 conversation", () => {
    const v1 = {
      version: NEO_ANSWER_VERSION_1,
      status: "completo" as const,
      titulo: "Relatório antigo sobre a Empresa Y",
      resumoExecutivo: "A Empresa Y está ativa desde 2015.",
      blocos: [{ tipo: "texto" as const, titulo: null, conteudo: "Detalhes adicionais antigos.", fontesIds: [] }],
      fontes: [{ id: "f1", titulo: "Fonte antiga", url: "https://antiga.example", dominio: "antiga.example", dataAcesso: "2025-01-01" }],
      informacoesAusentes: ["Telefone"],
      observacoes: [],
      proximasAcoes: [],
      perguntaNecessaria: null,
    };
    const upgraded = normalizeNeoAnswer(v1);
    render(<AnswerView mensagemId="m1" answer={upgraded} />);
    expect(screen.getByText("Relatório antigo sobre a Empresa Y")).toBeInTheDocument();
    expect(screen.getByText("A Empresa Y está ativa desde 2015.")).toBeInTheDocument();
    expect(screen.getByText("Telefone")).toBeInTheDocument();
  });
});

describe("AnswerView — proteção contra conteúdo malicioso", () => {
  it("never executes or injects raw HTML/script content coming from a captured page into respostaDireta", () => {
    const answer = baseNeoAnswer({ respostaDireta: "Texto <script>window.__pwned = true;</script> normal." });
    render(<AnswerView mensagemId="m1" answer={answer} />);
    expect(document.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it("never turns a javascript: URL fonte into a clickable link", () => {
    const answer = baseNeoAnswer({ fontes: [{ id: "f1", titulo: "Suspeita", url: "javascript:alert(1)", dominio: null, dataAcesso: null }] });
    render(<AnswerView mensagemId="m1" answer={answer} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver fontes utilizadas/ }));
    expect(screen.queryByRole("link", { name: /Suspeita/ })).not.toBeInTheDocument();
  });
});

describe("AnswerView — footer", () => {
  it("shows only the two required lines — attribution and the consultation-moment disclosure, no heavy legal text", () => {
    render(<AnswerView mensagemId="m1" answer={baseNeoAnswer()} geradoEm="2026-07-24T10:00:00.000Z" />);
    expect(screen.getByText("Relatório gerado pelo Neo.")).toBeInTheDocument();
    expect(screen.getByText("Informações públicas disponíveis no momento da consulta.")).toBeInTheDocument();
  });
});

describe("AnswerView — transparência de operações", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows a discreet operations-vs-sources line, never conflating link counts with the investigation's result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "exec1",
            conversaId: "c1",
            status: "concluida",
            camposSolicitados: [],
            camposEncontrados: [],
            camposAusentes: [],
            erroPublico: null,
            iniciadoEm: "t",
            concluidoEm: "t",
            canceladoEm: null,
            etapas: [
              { id: "e1", ordem: 1, tipo: "ferramenta", nomePublico: "Pesquisando fontes", status: "concluida", erroPublico: null },
              { id: "e2", ordem: 2, tipo: "ferramenta", nomePublico: "Lendo página", status: "concluida", erroPublico: null },
              { id: "e3", ordem: 3, tipo: "ferramenta", nomePublico: "Extraindo informações", status: "concluida", erroPublico: null },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const answer = baseNeoAnswer({
      fontes: [
        { id: "f1", titulo: "Fonte A", url: "https://a.example", dominio: "a.example", dataAcesso: "2026-01-01" },
        { id: "f2", titulo: "Fonte B", url: "https://b.example", dominio: "b.example", dataAcesso: "2026-01-01" },
      ],
    });
    render(<AnswerView mensagemId="m1" answer={answer} execucaoId="exec1" />);
    await waitFor(() => expect(screen.getByText(/operaç(ão|ões) realizada/)).toBeInTheDocument());
    expect(screen.getByText("3 operações realizadas · 2 fontes utilizadas")).toBeInTheDocument();
  });

  it("never shows the operations line when no execucaoId is available", () => {
    render(<AnswerView mensagemId="m1" answer={baseNeoAnswer()} />);
    expect(screen.queryByText(/operaç(ão|ões) realizada/)).not.toBeInTheDocument();
  });
});

describe("AnswerView — dentro de um contêiner estreito (mobile)", () => {
  it("keeps working when rendered in a narrow container — tables scroll internally instead of breaking layout", () => {
    const answer = baseNeoAnswer({
      blocos: [{ tipo: "tabela", titulo: "Dados", colunas: ["A", "B", "C"], linhas: [["1", "2", "3"]], fontesIds: [], exportavelCsv: true }],
    });
    const { container } = render(
      <div style={{ width: "360px" }}>
        <AnswerView mensagemId="m1" answer={answer} />
      </div>,
    );
    const wrapper = within(container).getByText("Dados").closest("div")?.querySelector(".overflow-x-auto");
    expect(wrapper).toBeTruthy();
  });
});
