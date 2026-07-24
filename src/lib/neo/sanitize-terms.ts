import type { NeoAnswer, NeoBloco } from "@/lib/neo/answer";

/**
 * Enforces the product's language rule: the word "investigação" (and any
 * inflection) may never reach the frontend — every report field Neo writes
 * itself must read "análise"/"pesquisa"/"consulta" instead. Applied once,
 * right where a NeoAnswer is produced (synthesizer.ts, fallback-answer.ts),
 * so every downstream consumer (DB, exports, frontend) already sees clean
 * text — this is defense-in-depth on top of the system prompt instruction,
 * since an LLM's own wording can never be fully guaranteed by a prompt alone.
 *
 * Only sanitizes Neo's own analytical prose (titulo, achados, respostaDireta,
 * lacunas, matrizEvidencias, block titles/narrative, extracted fact values).
 * Never touches verbatim external content the user's own search/page capture
 * produced (fonte titles, social bio/caption text) — censoring that would
 * violate the separate "never alter legitimate search results" rule.
 */

const BANNED_TERM_PATTERN = /investig\w*/gi;

function replaceBanned(text: string): string {
  return text.replace(BANNED_TERM_PATTERN, (match) => {
    const replacement = "análise";
    return match[0] === match[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
  });
}

function n(text: string | null): string | null {
  return text === null ? null : replaceBanned(text);
}

function sanitizeBloco(bloco: NeoBloco): NeoBloco {
  switch (bloco.tipo) {
    case "texto":
      return { ...bloco, titulo: n(bloco.titulo), conteudo: replaceBanned(bloco.conteudo) };
    case "fatos":
      return {
        ...bloco,
        titulo: n(bloco.titulo),
        itens: bloco.itens.map((f) => ({ ...f, rotulo: replaceBanned(f.rotulo), valor: replaceBanned(f.valor) })),
      };
    case "entidade":
      return {
        ...bloco,
        nome: replaceBanned(bloco.nome),
        subtitulo: n(bloco.subtitulo),
        descricao: n(bloco.descricao),
        atributos: bloco.atributos.map((a) => ({ ...a, rotulo: replaceBanned(a.rotulo), valor: replaceBanned(a.valor) })),
      };
    case "pessoa":
      return {
        ...bloco,
        nome: replaceBanned(bloco.nome),
        atributos: bloco.atributos.map((a) => ({ ...a, rotulo: replaceBanned(a.rotulo), valor: replaceBanned(a.valor) })),
        organizacoesRelacionadas: bloco.organizacoesRelacionadas.map((o) => ({ ...o, relacao: replaceBanned(o.relacao) })),
      };
    case "metricas":
      return { ...bloco, titulo: n(bloco.titulo), itens: bloco.itens.map((m) => ({ ...m, rotulo: replaceBanned(m.rotulo) })) };
    case "imagem":
      return { ...bloco, legenda: n(bloco.legenda) };
    case "tabela":
      return { ...bloco, titulo: n(bloco.titulo) };
    case "timeline":
      return {
        ...bloco,
        titulo: n(bloco.titulo),
        itens: bloco.itens.map((e) => ({ ...e, titulo: replaceBanned(e.titulo), descricao: n(e.descricao) })),
      };
    case "relacoes":
      return {
        ...bloco,
        titulo: n(bloco.titulo),
        itens: bloco.itens.map((r) => ({ ...r, relacao: replaceBanned(r.relacao), evidencia: n(r.evidencia) })),
      };
    case "alerta":
      return { ...bloco, mensagem: replaceBanned(bloco.mensagem) };
    case "perfil_social":
    case "publicacao":
      // Verbatim external content (bio/caption) — never rewritten.
      return bloco;
    default:
      return bloco;
  }
}

export function sanitizeBannedTerms(answer: NeoAnswer): NeoAnswer {
  return {
    ...answer,
    titulo: replaceBanned(answer.titulo),
    objetivo: replaceBanned(answer.objetivo),
    respostaDireta: replaceBanned(answer.respostaDireta),
    indicadoresPrincipais: answer.indicadoresPrincipais.map((i) => ({
      ...i,
      rotulo: replaceBanned(i.rotulo),
      valor: replaceBanned(i.valor),
      descricao: n(i.descricao),
    })),
    achados: answer.achados.map((a) => ({ ...a, conclusao: replaceBanned(a.conclusao), explicacao: replaceBanned(a.explicacao) })),
    blocos: answer.blocos.map(sanitizeBloco),
    lacunas: answer.lacunas.map((l) => ({ ...l, descricao: replaceBanned(l.descricao) })),
    matrizEvidencias: answer.matrizEvidencias.map((m) => ({
      ...m,
      conclusao: replaceBanned(m.conclusao),
      evidencia: replaceBanned(m.evidencia),
    })),
    observacoes: answer.observacoes.map(replaceBanned),
    proximasAcoes: answer.proximasAcoes.map(replaceBanned),
    perguntaNecessaria: n(answer.perguntaNecessaria),
  };
}
