import "server-only";
import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming, Response as NeoResponse } from "openai/resources/responses/responses";
import { getNeoApiKey } from "@/server/neo/config";
import { NeoConfigurationError } from "@/server/neo/errors";

let client: OpenAI | null = null;

/**
 * Singleton client for the LLM provider behind Neo. Server-only, key is
 * never cached to a module constant reachable from elsewhere, never logged.
 * Always throws NeoConfigurationError instead of silently degrading.
 */
export function getNeoClient(): OpenAI {
  if (client) return client;

  const apiKey = getNeoApiKey();
  if (!apiKey) throw new NeoConfigurationError();

  client = new OpenAI({ apiKey });
  return client;
}

/**
 * Single low-level entry point every phase (planner/executor/synthesizer)
 * goes through to call the LLM. Kept as one function so tests can mock this
 * module alone instead of the whole OpenAI SDK, and so nothing but this file
 * ever touches the raw client.
 */
export async function callNeoResponses(
  params: ResponseCreateParamsNonStreaming,
  signal?: AbortSignal,
): Promise<NeoResponse> {
  const openai = getNeoClient();
  return openai.responses.create(params, { signal });
}

/** Test-only: allows unit tests to reset the singleton between cases. */
export function __resetNeoClientForTests(): void {
  client = null;
}
