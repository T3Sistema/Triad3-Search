import "server-only";
import { sgaiRequest, type SgaiResult } from "@/server/integrations/web-intelligence/client";
import type { CreditsResponse } from "@/server/integrations/web-intelligence/types";

/** Shared service behind the "Créditos" widget and the Neo "consultar créditos" tool. */
export async function consultarCreditos(): Promise<SgaiResult<CreditsResponse>> {
  return sgaiRequest<CreditsResponse>("GET", "/credits", { timeoutMs: 15_000 });
}
