import "server-only";
import { z } from "zod";
import { zodResponsesFunction } from "openai/helpers/zod";
import type { NeoToolName } from "@/server/neo/tool-names";
import { isKnownTool, isPersistentTool } from "@/server/neo/tool-names";
import type { NormalizedFonte } from "@/server/neo/tool-normalizers";

export interface NeoToolContext {
  usuarioId: string;
  signal: AbortSignal;
}

export interface NeoToolExecutionResult {
  ok: boolean;
  resumo: unknown;
  fontes: NormalizedFonte[];
  parcial: boolean;
  informacoesAusentes: string[];
  erroPublico?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface NeoToolDefinition<TArgs = any> {
  name: NeoToolName;
  /** Friendly, pt-BR label — the only name ever shown to the user (progress panel, step history). */
  nomePublico: string;
  /** Model-facing description. Never shown to the user. */
  description: string;
  /** Persistent tools (create/edit/pause/resume/delete a monitor) always require explicit confirmation. */
  persistent: boolean;
  timeoutMs: number;
  parameters: z.ZodType<TArgs>;
  execute: (args: TArgs, ctx: NeoToolContext) => Promise<NeoToolExecutionResult>;
}

const registry = new Map<NeoToolName, NeoToolDefinition>();

export function registerNeoTool<TArgs>(definition: NeoToolDefinition<TArgs>): void {
  registry.set(definition.name, definition as NeoToolDefinition);
}

export function getNeoTool(name: string): NeoToolDefinition | undefined {
  if (!isKnownTool(name)) return undefined;
  return registry.get(name);
}

export function listNeoTools(): NeoToolDefinition[] {
  return Array.from(registry.values());
}

export function isNeoToolPersistent(name: string): boolean {
  return isPersistentTool(name);
}

/** Builds the `tools` array for the OpenAI Responses API from the current registry. */
export function buildResponsesTools() {
  return listNeoTools().map((tool) =>
    zodResponsesFunction({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }),
  );
}

export function clearNeoToolRegistryForTests(): void {
  registry.clear();
}
