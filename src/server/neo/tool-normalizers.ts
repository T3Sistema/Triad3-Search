import "server-only";
import { NEO_LIMITS } from "@/server/neo/limits";
import type {
  CrawlPagesResponse,
  CrawlStatusResponse,
  CreditsResponse,
  ExtractResponse,
  HistoryItem,
  HistoryListResponse,
  MonitorActivityResponse,
  MonitorListResponse,
  MonitorResponse,
  ScrapeResponse,
  SearchResponse,
} from "@/server/integrations/web-intelligence/types";

/**
 * Compresses raw provider responses into the small, model-friendly shape
 * the executor hands back as `function_call_output`. Raw responses can be
 * arbitrarily large (full page HTML, hundreds of crawl pages) — the model
 * only ever sees the fields it can act on, capped well under
 * NEO_LIMITS.maxNormalizedContentChars. The untouched original stays only
 * in the manual module's own response (never persisted by Neo).
 */

export interface NormalizedFonte {
  url: string;
  titulo?: string;
  dominio?: string;
  dataObservacao?: string;
}

export interface NeoToolOutput {
  resumo: unknown;
  fontes: NormalizedFonte[];
  parcial: boolean;
  informacoesAusentes: string[];
}

function truncate(text: string | undefined | null, max = 1200): string | undefined {
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function capArray<T>(arr: T[] | undefined, max: number): T[] {
  if (!arr) return [];
  return arr.slice(0, max);
}

function clampJson(value: unknown, max = NEO_LIMITS.maxNormalizedContentChars): unknown {
  const serialized = JSON.stringify(value);
  if (serialized.length <= max) return value;
  return { aviso: "Resultado truncado por exceder o limite de contexto.", amostra: serialized.slice(0, max) };
}

export function normalizeCapturar(requestUrl: string, data: ScrapeResponse): NeoToolOutput {
  const results = data.results ?? {};
  const resumo = {
    id: data.id,
    status: data.status,
    markdown: truncate(typeof results.markdown?.data === "string" ? results.markdown.data : undefined, 4000),
    resumoConteudo: truncate(typeof results.summary?.data === "string" ? results.summary.data : undefined, 1500),
    links: capArray(
      Array.isArray(results.links?.data) ? (results.links?.data as unknown[]) : undefined,
      30,
    ),
    imagens: capArray(
      Array.isArray(results.images?.data) ? (results.images?.data as unknown[]) : undefined,
      20,
    ),
    metadados: results.markdown?.metadata ?? data.metadata,
  };
  return {
    resumo: clampJson(resumo),
    fontes: [{ url: requestUrl, dominio: domainOf(requestUrl) }],
    parcial: data.status ? data.status !== "completed" && data.status !== "ok" : false,
    informacoesAusentes: [],
  };
}

export function normalizeExtrair(source: string, data: ExtractResponse): NeoToolOutput {
  return {
    resumo: clampJson({ id: data.id, json: data.json, usage: data.usage }),
    fontes: source.startsWith("http") ? [{ url: source, dominio: domainOf(source) }] : [],
    parcial: false,
    informacoesAusentes: [],
  };
}

export function normalizePesquisar(query: string, data: SearchResponse): NeoToolOutput {
  const results = capArray(data.results, 10).map((item) => ({
    url: item.url,
    titulo: item.title,
    trecho: truncate(item.content, 500),
  }));
  return {
    resumo: clampJson({ consulta: query, resultados: results, totalResultados: data.results?.length ?? 0 }),
    fontes: results.filter((r): r is typeof r & { url: string } => Boolean(r.url)).map((r) => ({
      url: r.url,
      titulo: r.titulo,
      dominio: domainOf(r.url),
    })),
    parcial: false,
    informacoesAusentes: results.length === 0 ? ["Nenhum resultado encontrado para a consulta."] : [],
  };
}

export function normalizeMapearStatus(data: CrawlStatusResponse): NeoToolOutput {
  const pages = capArray(data.pages, 40).map((p) => ({
    url: p.url,
    titulo: p.title,
    status: p.status,
    profundidade: p.depth,
  }));
  return {
    resumo: clampJson({
      id: data.id,
      status: data.status,
      total: data.total,
      finalizadas: data.finished,
      paginas: pages,
    }),
    fontes: pages.filter((p): p is typeof p & { url: string } => Boolean(p.url)).map((p) => ({
      url: p.url,
      titulo: p.titulo,
      dominio: domainOf(p.url),
    })),
    parcial: data.status === "running",
    informacoesAusentes: [],
  };
}

export function normalizeMapearPaginas(data: CrawlPagesResponse): NeoToolOutput {
  const pages = capArray(data.data, 60).map((p) => ({ url: p.url, titulo: p.title, status: p.status }));
  return {
    resumo: clampJson({ paginas: pages, proximoCursor: data.pagination?.nextCursor ?? null }),
    fontes: pages.filter((p): p is typeof p & { url: string } => Boolean(p.url)).map((p) => ({
      url: p.url,
      titulo: p.titulo,
      dominio: domainOf(p.url),
    })),
    parcial: Boolean(data.pagination?.nextCursor),
    informacoesAusentes: [],
  };
}

function normalizeMonitorItem(m: MonitorResponse) {
  return {
    id: m.cronId ?? m.scheduleId,
    nome: m.name,
    url: m.url,
    status: m.status,
    intervalo: m.interval,
    criadoEm: m.createdAt,
    atualizadoEm: m.updatedAt,
  };
}

export function normalizeMonitor(data: MonitorResponse): NeoToolOutput {
  const item = normalizeMonitorItem(data);
  return {
    resumo: clampJson(item),
    fontes: item.url ? [{ url: item.url, dominio: domainOf(item.url) }] : [],
    parcial: false,
    informacoesAusentes: [],
  };
}

export function normalizeMonitorLista(data: MonitorListResponse): NeoToolOutput {
  const itens = capArray(data.data, 40).map(normalizeMonitorItem);
  return {
    resumo: clampJson({ itens, paginacao: data.pagination }),
    fontes: [],
    parcial: Boolean(data.pagination?.nextCursor),
    informacoesAusentes: [],
  };
}

export function normalizeMonitorAtividades(data: MonitorActivityResponse): NeoToolOutput {
  const ticks = capArray(data.ticks, 40).map((t) => ({
    id: t.id,
    status: t.status,
    criadoEm: t.createdAt,
    mudou: t.changed,
  }));
  return {
    resumo: clampJson({ ticks, proximoCursor: data.nextCursor ?? null }),
    fontes: [],
    parcial: Boolean(data.nextCursor),
    informacoesAusentes: [],
  };
}

export function normalizeHistoricoLista(data: HistoryListResponse): NeoToolOutput {
  const itens = capArray(data.data, 30).map((h) => ({
    id: h.id,
    servico: h.service,
    status: h.status,
    criadoEm: h.createdAt,
  }));
  return {
    resumo: clampJson({ itens, paginacao: data.pagination }),
    fontes: [],
    parcial: false,
    informacoesAusentes: [],
  };
}

export function normalizeHistoricoItem(data: HistoryItem): NeoToolOutput {
  return {
    resumo: clampJson({
      id: data.id,
      servico: data.service,
      status: data.status,
      criadoEm: data.createdAt,
      params: data.params,
    }),
    fontes: [],
    parcial: false,
    informacoesAusentes: [],
  };
}

export function normalizeCreditos(data: CreditsResponse): NeoToolOutput {
  return {
    resumo: clampJson({ restante: data.remaining, usado: data.used, plano: data.plan }),
    fontes: [],
    parcial: false,
    informacoesAusentes: [],
  };
}
