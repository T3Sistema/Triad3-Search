import type { NeoAnswer } from "@/lib/neo/answer";

/**
 * Maps each fonte id to the short list of claims it was cited to support —
 * used only to enrich the collapsed sources section ("informação que ela
 * sustentou"). Best-effort: walks the structures that carry fontesIds and a
 * human-readable label next to them; anything uncited simply gets no label.
 */
export function buildFonteUsageMap(answer: NeoAnswer): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  const add = (fontesIds: string[], label: string) => {
    if (!label) return;
    for (const id of fontesIds) {
      const atual = usage.get(id) ?? [];
      if (!atual.includes(label)) atual.push(label);
      usage.set(id, atual);
    }
  };

  for (const achado of answer.achados) add(achado.fontesIds, achado.conclusao);

  for (const bloco of answer.blocos) {
    switch (bloco.tipo) {
      case "fatos":
        for (const f of bloco.itens) add(f.fontesIds, f.rotulo);
        break;
      case "entidade":
      case "pessoa":
        for (const a of bloco.atributos) add(a.fontesIds, a.rotulo);
        break;
      case "metricas":
        for (const m of bloco.itens) add(m.fontesIds, m.rotulo);
        break;
      case "timeline":
        for (const e of bloco.itens) add(e.fontesIds, e.titulo);
        break;
      case "relacoes":
        for (const r of bloco.itens) add(r.fontesIds, `${r.origem} → ${r.destino}`);
        break;
      case "perfil_social":
      case "publicacao":
        add(bloco.fontesIds, bloco.tipo === "perfil_social" ? bloco.nome : "Publicação");
        break;
      default:
        break;
    }
  }

  return usage;
}
