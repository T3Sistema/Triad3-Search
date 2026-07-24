import "server-only";

/**
 * Structured, server-only execution logs. Never includes secrets, prompts,
 * or vendor/model identifiers — just enough to diagnose a stuck or slow
 * investigation from server logs (Vercel function logs) without a debugger.
 * Deliberately plain console.log/console.warn (no external logging vendor)
 * so this stays dependency-free and easy to grep.
 */
export interface NeoLogFields {
  execucaoId: string;
  fase?: string;
  rodada?: number;
  ferramenta?: string;
  duracaoMs?: number;
  concluidas?: number;
  orcamentoRestanteMs?: number;
  motivoFinalizacao?: string;
  relatorio?: "completo" | "parcial" | "fallback";
  [key: string]: unknown;
}

function log(level: "log" | "warn", event: string, fields: NeoLogFields): void {
  const payload = { escopo: "neo", evento: event, ts: new Date().toISOString(), ...fields };
  console[level](JSON.stringify(payload));
}

export function logNeoInfo(event: string, fields: NeoLogFields): void {
  log("log", event, fields);
}

export function logNeoWarn(event: string, fields: NeoLogFields): void {
  log("warn", event, fields);
}
