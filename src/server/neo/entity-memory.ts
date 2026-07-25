import "server-only";
import { neoEntidadeMemoriaSchema, type NeoEntidade, type NeoEntidadeMemoria, type NeoEntidadeTipo } from "@/lib/neo/entity";
import type { NeoAnswer, NeoBloco } from "@/lib/neo/answer";

/**
 * Structured entity memory (regra permanente: "nunca colapsar CNPJs
 * diferentes porque possuem o mesmo nome; nunca escolher um CNPJ
 * arbitrariamente"). Two entities are only ever merged when their
 * `identificador` (a canonical value — CNPJ digits-only, a normalized
 * domain, an e-mail) matches exactly; a same-tipo entity with an identical
 * `rotulo` but no matching identifier is always kept as a distinct entry.
 * This merge logic is pure and runs entirely in code — the model never
 * decides whether two entities are "the same thing".
 */

let nextIdCounter = 0;

/** Deterministic-enough local id, unique within a single merge call — never derived from or trusted to the model. */
function nextEntidadeId(existentes: NeoEntidade[]): string {
  const used = new Set(existentes.map((e) => e.id));
  let id: string;
  do {
    nextIdCounter += 1;
    id = `e${existentes.length + nextIdCounter}`;
  } while (used.has(id));
  return id;
}

function normalizeIdentificador(tipo: NeoEntidadeTipo, valor: string | null): string | null {
  if (!valor) return null;
  const trimmed = valor.trim();
  if (!trimmed) return null;
  if (tipo === "empresa") return trimmed.replace(/\D/g, "") || null; // CNPJ, digits-only
  if (tipo === "dominio" || tipo === "email") return trimmed.toLowerCase();
  return trimmed;
}

export function parseEntidadeMemoria(raw: unknown): NeoEntidadeMemoria {
  const parsed = neoEntidadeMemoriaSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/**
 * Merges one candidate entity into existing memory. Returns the (possibly
 * unchanged) memory array plus the id the candidate ended up under — a new
 * entity when no safe merge target exists, the matched entity's id
 * otherwise. Vínculos and fonteUrls are unioned, never overwritten.
 */
function mergeOne(memoria: NeoEntidade[], candidata: Omit<NeoEntidade, "id" | "atualizadoEm">): { memoria: NeoEntidade[]; id: string } {
  const identificador = normalizeIdentificador(candidata.tipo, candidata.identificador);
  const alvo = identificador ? memoria.find((e) => e.tipo === candidata.tipo && e.identificador === identificador) : undefined;

  if (alvo) {
    const atualizada: NeoEntidade = {
      ...alvo,
      rotulo: candidata.rotulo || alvo.rotulo,
      atributos: { ...alvo.atributos, ...candidata.atributos },
      vinculos: dedupVinculos([...alvo.vinculos, ...candidata.vinculos]),
      fonteUrls: Array.from(new Set([...alvo.fonteUrls, ...candidata.fonteUrls])),
      atualizadoEm: new Date().toISOString(),
    };
    return { memoria: memoria.map((e) => (e.id === alvo.id ? atualizada : e)), id: alvo.id };
  }

  const id = nextEntidadeId(memoria);
  const nova: NeoEntidade = {
    id,
    tipo: candidata.tipo,
    rotulo: candidata.rotulo,
    identificador,
    atributos: candidata.atributos,
    vinculos: dedupVinculos(candidata.vinculos),
    fonteUrls: candidata.fonteUrls,
    atualizadoEm: new Date().toISOString(),
  };
  return { memoria: [...memoria, nova], id };
}

function dedupVinculos(vinculos: NeoEntidade["vinculos"]): NeoEntidade["vinculos"] {
  const seen = new Set<string>();
  const out: NeoEntidade["vinculos"] = [];
  for (const v of vinculos) {
    const key = `${v.entidadeId}:${v.classificacao}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function blocoToEntidadeCandidate(bloco: NeoBloco): Omit<NeoEntidade, "id" | "atualizadoEm"> | null {
  if (bloco.tipo === "entidade") {
    const cnpj = bloco.identificadores.find((a) => /cnpj/i.test(a.rotulo))?.valor ?? null;
    return {
      tipo: "empresa",
      rotulo: bloco.nome,
      identificador: cnpj,
      atributos: Object.fromEntries(bloco.identificadores.map((a) => [a.rotulo, a.valor])),
      vinculos: [],
      fonteUrls: [],
    };
  }
  if (bloco.tipo === "pessoa") {
    return {
      tipo: "pessoa",
      rotulo: bloco.nome,
      identificador: null,
      atributos: {},
      vinculos: [],
      fonteUrls: [],
    };
  }
  if (bloco.tipo === "perfil_social") {
    return {
      tipo: "perfil_social",
      rotulo: bloco.nome,
      identificador: bloco.url,
      atributos: bloco.arroba ? { arroba: bloco.arroba } : {},
      vinculos: [],
      fonteUrls: [],
    };
  }
  return null;
}

/**
 * Refreshes a conversation's entity memory from a just-completed relatório —
 * the only point new entities enter memory. Company/person/social-profile
 * blocos become entities; pessoa blocos found alongside an entidade bloco in
 * the same relatório are linked to it (classification defaults to the
 * strongest role found on the pessoa bloco, when any).
 */
export function refreshEntityMemoryFromAnswer(memoriaAtual: NeoEntidadeMemoria, answer: NeoAnswer): NeoEntidadeMemoria {
  let memoria = [...memoriaAtual];
  const empresaIds: string[] = [];
  const pessoaEntries: Array<{ id: string; bloco: Extract<NeoBloco, { tipo: "pessoa" }> }> = [];

  for (const bloco of answer.blocos) {
    const candidata = blocoToEntidadeCandidate(bloco);
    if (!candidata) continue;
    const result = mergeOne(memoria, candidata);
    memoria = result.memoria;
    if (bloco.tipo === "entidade") empresaIds.push(result.id);
    if (bloco.tipo === "pessoa") pessoaEntries.push({ id: result.id, bloco });
  }

  if (empresaIds.length > 0 && pessoaEntries.length > 0) {
    for (const { id: pessoaId, bloco } of pessoaEntries) {
      const papel = bloco.papeis[0];
      const classificacao = papel ? mapPapelParaVinculo(papel.classificacao) : "vinculo_provavel";
      for (const empresaId of empresaIds) {
        memoria = memoria.map((e) => {
          if (e.id === pessoaId) {
            return { ...e, vinculos: dedupVinculos([...e.vinculos, { entidadeId: empresaId, classificacao, evidencia: papel?.evidencia ?? null }]) };
          }
          if (e.id === empresaId) {
            return { ...e, vinculos: dedupVinculos([...e.vinculos, { entidadeId: pessoaId, classificacao, evidencia: papel?.evidencia ?? null }]) };
          }
          return e;
        });
      }
    }
  }

  return memoria;
}

function mapPapelParaVinculo(papel: string): NeoEntidade["vinculos"][number]["classificacao"] {
  if (papel === "relacionado") return "vinculo_provavel";
  return "vinculo_direto";
}

/** Compact, token-cheap summary fed into the next turn's context — never the full memory blob. */
export function summarizeEntityMemory(memoria: NeoEntidadeMemoria, max = 12): string {
  if (memoria.length === 0) return "";
  return memoria
    .slice(-max)
    .map((e) => {
      const vinculos = e.vinculos.map((v) => `${v.classificacao}→${v.entidadeId}`).join(", ");
      return `[${e.id}] ${e.tipo}: ${e.rotulo}${e.identificador ? ` (${e.identificador})` : ""}${vinculos ? ` — vínculos: ${vinculos}` : ""}`;
    })
    .join("\n");
}
