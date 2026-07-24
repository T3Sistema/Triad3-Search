import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/db/repositories/neo-conversas");

import * as conversasRepo from "@/server/db/repositories/neo-conversas";
import { GET, POST } from "./route";

function makeGetRequest(query = "") {
  return new Request(`http://localhost/api/triad3/neo/conversas${query}`);
}

function makePostRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/triad3/neo/conversas", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("/api/triad3/neo/conversas", () => {
  beforeEach(() => {
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("GET denies access with 401 when there is no valid session", async () => {
    requireApiUser.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 401 }) });
    const response = await GET(makeGetRequest());
    expect(response.status).toBe(401);
  });

  it("GET only returns conversations belonging to the authenticated user", async () => {
    vi.mocked(conversasRepo.listarConversas).mockResolvedValue([]);
    await GET(makeGetRequest());
    expect(conversasRepo.listarConversas).toHaveBeenCalledWith("u1", expect.anything());
  });

  it("POST rejects requests from an untrusted cross-site origin", async () => {
    const response = await POST(makePostRequest({}, { "sec-fetch-site": "cross-site" }));
    expect(response.status).toBe(403);
  });

  it("POST creates a conversation for the authenticated user, defaulting the title", async () => {
    vi.mocked(conversasRepo.criarConversa).mockResolvedValue({
      id: "c1",
      usuarioId: "u1",
      titulo: "Nova conversa",
      resumoContexto: null,
      status: "ativa",
      criadoEm: "t",
      atualizadoEm: "t",
    });
    const response = await POST(makePostRequest({}));
    expect(response.status).toBe(201);
    expect(conversasRepo.criarConversa).toHaveBeenCalledWith({ usuarioId: "u1", titulo: "Nova conversa" });
  });

  it("POST rejects an invalid payload (titulo too long)", async () => {
    const response = await POST(makePostRequest({ titulo: "a".repeat(500) }));
    expect(response.status).toBe(400);
  });
});
