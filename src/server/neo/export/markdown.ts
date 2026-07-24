import "server-only";
import type { NeoAnswer, NeoBloco } from "@/lib/neo/answer";

function renderBloco(bloco: NeoBloco): string {
  switch (bloco.tipo) {
    case "texto":
      return [bloco.titulo ? `### ${bloco.titulo}` : null, bloco.conteudo].filter(Boolean).join("\n\n");
    case "fatos":
      return [
        bloco.titulo ? `### ${bloco.titulo}` : null,
        ...bloco.itens.map(
          (f) => `- **${f.rotulo}:** ${f.valor} _(${f.nivelEvidencia}${f.dataObservacao ? `, observado em ${f.dataObservacao}` : ""})_`,
        ),
      ]
        .filter(Boolean)
        .join("\n");
    case "entidade":
      return [
        `### ${bloco.nome}`,
        bloco.subtitulo,
        bloco.descricao,
        ...bloco.atributos.map((a) => `- **${a.rotulo}:** ${a.valor}`),
        ...bloco.links.map((l) => `- [${l.rotulo}](${l.url})`),
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
    case "fontes":
      return bloco.itens.map((f) => `- [${f.titulo ?? f.url}](${f.url})`).join("\n");
    default:
      return "";
  }
}

export function renderNeoAnswerAsMarkdown(answer: NeoAnswer): string {
  const parts: string[] = [];
  parts.push(`# ${answer.titulo}`);
  parts.push(answer.resumoExecutivo);
  for (const bloco of answer.blocos) {
    const rendered = renderBloco(bloco);
    if (rendered) parts.push(rendered);
  }
  if (answer.informacoesAusentes.length > 0) {
    parts.push(`## Informações não localizadas\n\n${answer.informacoesAusentes.map((i) => `- ${i}`).join("\n")}`);
  }
  if (answer.observacoes.length > 0) {
    parts.push(`## Observações\n\n${answer.observacoes.map((o) => `- ${o}`).join("\n")}`);
  }
  if (answer.fontes.length > 0) {
    parts.push(
      `## Fontes\n\n${answer.fontes.map((f) => `- [${f.titulo ?? f.url}](${f.url})${f.dataAcesso ? ` — consultado em ${f.dataAcesso}` : ""}`).join("\n")}`,
    );
  }
  return parts.join("\n\n") + "\n";
}
