/**
 * Presentation layer for status/enum values returned by the backend. Raw
 * values are preserved wherever they're used programmatically (badge color,
 * filters, API payloads) — only the rendered label goes through this map.
 */
export const STATUS_LABELS: Record<string, string> = {
  running: "Em execução",
  completed: "Concluído",
  failed: "Falhou",
  stopped: "Interrompido",
  active: "Ativo",
  paused: "Pausado",
  pending: "Pendente",
  connected: "Conectado",
  disconnected: "Desconectado",
  deleted: "Excluído",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  ok: "Concluído",
  error: "Erro",
};

export function translateStatus(status?: string | null): string {
  if (!status) return "—";
  return STATUS_LABELS[status.toLowerCase()] ?? status;
}

export type BadgeTone = "success" | "warning" | "error" | "neutral";

const STATUS_TONES: Record<string, BadgeTone> = {
  running: "warning",
  completed: "success",
  ok: "success",
  active: "success",
  connected: "success",
  failed: "error",
  error: "error",
  disconnected: "error",
  stopped: "neutral",
  paused: "warning",
  pending: "neutral",
  deleted: "error",
  cancelled: "neutral",
  canceled: "neutral",
};

export function toneForStatus(status?: string | null): BadgeTone {
  if (!status) return "neutral";
  return STATUS_TONES[status.toLowerCase()] ?? "neutral";
}

export const SERVICE_LABELS: Record<string, string> = {
  scrape: "Captura",
  extract: "Extração",
  search: "Pesquisa",
  monitor: "Monitoramento",
  crawl: "Mapeamento",
  schema: "Schema",
};

export function translateService(service?: string | null): string {
  if (!service) return "—";
  return SERVICE_LABELS[service.toLowerCase()] ?? service;
}

// --- Neo -------------------------------------------------------------------

export const NEO_EXECUCAO_STATUS_LABELS: Record<string, string> = {
  planejando: "Planejando",
  executando: "Analisando",
  verificando: "Verificando",
  sintetizando: "Preparando relatório",
  aguardando_confirmacao: "Aguardando confirmação",
  concluida: "Concluída",
  parcial: "Parcial",
  falhou: "Falhou",
  cancelada: "Cancelada",
};

export function translateNeoExecucaoStatus(status?: string | null): string {
  if (!status) return "—";
  return NEO_EXECUCAO_STATUS_LABELS[status.toLowerCase()] ?? status;
}

export const NEO_MENSAGEM_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  concluida: "Concluída",
  parcial: "Parcial",
  falhou: "Falhou",
  cancelada: "Cancelada",
};

export function translateNeoMensagemStatus(status?: string | null): string {
  if (!status) return "—";
  return NEO_MENSAGEM_STATUS_LABELS[status.toLowerCase()] ?? status;
}

export const NEO_ANSWER_STATUS_LABELS: Record<string, string> = {
  completo: "Concluído",
  parcial: "Parcial",
  precisa_de_informacao: "Precisa de mais informações",
  nao_concluido: "Não concluído",
};

export function translateNeoAnswerStatus(status?: string | null): string {
  if (!status) return "—";
  return NEO_ANSWER_STATUS_LABELS[status.toLowerCase()] ?? status;
}

export const NEO_NIVEL_EVIDENCIA_LABELS: Record<string, string> = {
  confirmado: "Confirmado",
  bem_sustentado: "Bem sustentado",
  indicio: "Indício",
  nao_localizado: "Não localizado",
  divergente: "Divergente",
};

export function translateNivelEvidencia(nivel?: string | null): string {
  if (!nivel) return "—";
  return NEO_NIVEL_EVIDENCIA_LABELS[nivel.toLowerCase()] ?? nivel;
}

const NEO_NIVEL_EVIDENCIA_TONES: Record<string, BadgeTone> = {
  confirmado: "success",
  bem_sustentado: "success",
  indicio: "warning",
  nao_localizado: "neutral",
  divergente: "error",
};

export function toneForNivelEvidencia(nivel?: string | null): BadgeTone {
  if (!nivel) return "neutral";
  return NEO_NIVEL_EVIDENCIA_TONES[nivel.toLowerCase()] ?? "neutral";
}

export const NEO_ALERTA_CATEGORIA_LABELS: Record<string, string> = {
  informacao_ausente: "Informação ausente",
  divergencia: "Divergência",
  resultado_parcial: "Resultado parcial",
  limitacao: "Limitação",
  cuidado_interpretativo: "Cuidado interpretativo",
};

export function translateAlertaCategoria(categoria?: string | null): string {
  if (!categoria) return "—";
  return NEO_ALERTA_CATEGORIA_LABELS[categoria.toLowerCase()] ?? categoria;
}

export const NEO_LACUNA_TIPO_LABELS: Record<string, string> = {
  nao_encontrado: "Não encontrado",
  nao_confirmado: "Não confirmado",
  contraditorio: "Contraditório",
  pode_ter_mudado: "Pode ter mudado",
  consulta_complementar: "Consulta complementar",
};

export function translateLacunaTipo(tipo?: string | null): string {
  if (!tipo) return "—";
  return NEO_LACUNA_TIPO_LABELS[tipo.toLowerCase()] ?? tipo;
}

export const NEO_PAPEL_PESSOA_LABELS: Record<string, string> = {
  responsavel_legal: "Responsável legal",
  administrador: "Administrador",
  socio: "Sócio",
  fundador: "Fundador",
  proprietario: "Proprietário",
  representante_publico: "Representante público",
  relacionado: "Pessoa relacionada",
};

export function translatePapelPessoa(papel?: string | null): string {
  if (!papel) return "—";
  return NEO_PAPEL_PESSOA_LABELS[papel.toLowerCase()] ?? papel;
}

/** Rótulos exigidos especificamente para a matriz "Como cada conclusão foi sustentada" — reaproveita o enum de nível de evidência com o vocabulário exato pedido para essa seção. */
export const NEO_EVIDENCIA_MATRIZ_LABELS: Record<string, string> = {
  confirmado: "Confirmado",
  bem_sustentado: "Relacionado",
  indicio: "Não confirmado",
  nao_localizado: "Não encontrado",
  divergente: "Informação variável",
};

export function translateEvidenciaMatrizClassificacao(classificacao?: string | null): string {
  if (!classificacao) return "—";
  return NEO_EVIDENCIA_MATRIZ_LABELS[classificacao.toLowerCase()] ?? classificacao;
}
