import "server-only";
import type { NeoAnswer, NeoBloco } from "@/lib/neo/answer";
import { translateEvidenciaMatrizClassificacao, translateLacunaTipo, translateNivelEvidencia } from "@/lib/ui/status-labels";

function renderBloco(bloco: NeoBloco): string {
  switch (bloco.tipo) {
    case "texto":
      return [bloco.titulo ? `### ${bloco.titulo}` : null, bloco.conteudo].filter(Boolean).join("\n\n");
    case "fatos":
      return [
        bloco.titulo ? `### ${bloco.titulo}` : null,
        ...bloco.itens.map(
          (f) => `- **${f.rotulo}:** ${f.valor} _(${translateNivelEvidencia(f.nivelEvidencia)}${f.dataObservacao ? `, observado em ${f.dataObservacao}` : ""})_`,
        ),
      ]
        .filter(Boolean)
        .join("\n");
    case "entidade":
      return [
        `### ${bloco.nome}`,
        bloco.subtitulo,
        bloco.descricao,
        ...bloco.identificadores.map((a) => `- **${a.rotulo}:** ${a.valor}`),
        ...bloco.atributos.map((a) => `- **${a.rotulo}:** ${a.valor} _(${translateNivelEvidencia(a.nivelEvidencia)})_`),
        ...bloco.links.map((l) => `- [${l.rotulo}](${l.url})`),
      ]
        .filter(Boolean)
        .join("\n\n");
    case "pessoa":
      return [
        `### ${bloco.nome}`,
        ...bloco.papeis.map((p) => `- ${p.classificacao} _(${translateNivelEvidencia(p.nivelEvidencia)})_`),
        ...bloco.organizacoesRelacionadas.map((o) => `- ${o.nome}: ${o.relacao}`),
        ...bloco.atributos.map((a) => `- **${a.rotulo}:** ${a.valor} _(${translateNivelEvidencia(a.nivelEvidencia)})_`),
      ]
        .filter(Boolean)
        .join("\n");
    case "perfil_social":
      return [
        `### ${bloco.nome}${bloco.arroba ? ` (${bloco.arroba})` : ""}`,
        bloco.bio,
        [
          bloco.seguidores ? `${bloco.seguidores} seguidores` : null,
          bloco.seguindo ? `${bloco.seguindo} seguindo` : null,
          bloco.publicacoes ? `${bloco.publicacoes} publicações` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        bloco.relacao,
        bloco.metricaVariavel ? "_Métricas variáveis, sujeitas a mudança._" : null,
        bloco.url ? `[Ver perfil](${bloco.url})` : null,
      ]
        .filter(Boolean)
        .join("\n\n");
    case "publicacao":
      return [
        bloco.legenda,
        [
          bloco.dataPublicacao,
          bloco.curtidas ? `${bloco.curtidas} curtidas` : null,
          bloco.comentarios ? `${bloco.comentarios} comentários` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        bloco.contexto,
        bloco.url ? `[Ver publicação original](${bloco.url})` : null,
      ]
        .filter(Boolean)
        .join("\n\n");
    case "metricas":
      return [
        bloco.titulo ? `### ${bloco.titulo}` : null,
        ...bloco.itens.map((m) => `- **${m.rotulo}:** ${m.valor}${m.unidade ? ` ${m.unidade}` : ""}`),
      ]
        .filter(Boolean)
        .join("\n");
    case "imagem":
      return `![${bloco.textoAlternativo}](${bloco.url})${bloco.legenda ? `\n\n_${bloco.legenda}_` : ""}`;
    case "tabela": {
      const header = `| ${bloco.colunas.join(" | ")} |`;
      const divider = `| ${bloco.colunas.map(() => "---").join(" | ")} |`;
      const rows = bloco.linhas.map((linha) => `| ${linha.join(" | ")} |`);
      return [bloco.titulo ? `### ${bloco.titulo}` : null, header, divider, ...rows].filter(Boolean).join("\n");
    }
    case "timeline":
      return [
        bloco.titulo ? `### ${bloco.titulo}` : null,
        ...bloco.itens.map((e) => `- ${e.data ? `**${e.data}** — ` : ""}${e.titulo}${e.descricao ? `: ${e.descricao}` : ""}`),
      ]
        .filter(Boolean)
        .join("\n");
    case "relacoes":
      return [
        bloco.titulo ? `### ${bloco.titulo}` : null,
        ...bloco.itens.map((r) => `- ${r.origem} → **${r.relacao}** → ${r.destino}`),
      ]
        .filter(Boolean)
        .join("\n");
    case "alerta":
      return `> ⚠️ ${bloco.mensagem}`;
    default:
      return "";
  }
}

export function renderNeoAnswerAsMarkdown(answer: NeoAnswer): string {
  const parts: string[] = [];
  parts.push(`# ${answer.titulo}`);
  if (answer.objetivo) parts.push(answer.objetivo);

  if (answer.indicadoresPrincipais.length > 0) {
    parts.push(answer.indicadoresPrincipais.map((i) => `**${i.rotulo}:** ${i.valor}`).join("  \n"));
  }

  if (answer.achados.length > 0) {
    parts.push(
      `## Principais descobertas\n\n${answer.achados
        .map((a, i) => `${i + 1}. **${a.conclusao}** _(${translateNivelEvidencia(a.nivelEvidencia)})_ — ${a.explicacao}`)
        .join("\n")}`,
    );
  }

  if (answer.respostaDireta) {
    parts.push(`## Resposta do Neo\n\n${answer.respostaDireta}`);
  }

  for (const bloco of answer.blocos) {
    const rendered = renderBloco(bloco);
    if (rendered) parts.push(rendered);
  }

  if (answer.lacunas.length > 0) {
    parts.push(
      `## O que ainda precisa ser confirmado\n\n${answer.lacunas.map((l) => `- **${translateLacunaTipo(l.tipo)}:** ${l.descricao}`).join("\n")}`,
    );
  }

  if (answer.matrizEvidencias.length > 0) {
    const header = "| Conclusão | Evidência | Classificação |";
    const divider = "| --- | --- | --- |";
    const rows = answer.matrizEvidencias.map(
      (m) => `| ${m.conclusao} | ${m.evidencia} | ${translateEvidenciaMatrizClassificacao(m.classificacao)} |`,
    );
    parts.push(`## Como cada conclusão foi sustentada\n\n${[header, divider, ...rows].join("\n")}`);
  }

  if (answer.fontes.length > 0) {
    parts.push(
      `## Fontes utilizadas\n\n${answer.fontes.map((f, i) => `${i + 1}. [${f.titulo ?? f.url}](${f.url})${f.dataAcesso ? ` — consultado em ${f.dataAcesso}` : ""}`).join("\n")}`,
    );
  }

  parts.push("Relatório gerado pelo Neo.\nInformações públicas disponíveis no momento da consulta.");

  return parts.join("\n\n") + "\n";
}
