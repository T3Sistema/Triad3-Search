import { NextResponse } from "next/server";
import { readJsonBody, rejectUntrustedOrigin, validationErrorResponse } from "@/lib/api-utils";
import { loginRequestSchema } from "@/lib/auth/schemas";
import { normalizeEmail } from "@/lib/auth/validation";
import { buscarUsuarioParaLogin, contaTemporariamenteBloqueada, registrarFalhaLogin, registrarLoginSucesso } from "@/server/auth/users";
import { verifyDummyPassword, verifyPassword } from "@/server/auth/password";
import { estaBloqueadoPorRateLimit, registrarTentativaLogin } from "@/server/auth/rate-limit";
import { criarSessao } from "@/server/auth/sessions";
import { buildSessionCookie } from "@/server/auth/config";
import { sha256Hex } from "@/server/auth/hash-utils";
import { getClientIp } from "@/server/auth/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_ERROR = "E-mail ou senha inválidos.";
const RATE_LIMIT_ERROR = "Muitas tentativas. Tente novamente em alguns minutos.";
const NO_STORE = { "Cache-Control": "no-store" } as const;

function unauthorized(message: string, status: 401 | 429, type: "unauthorized" | "rate_limited") {
  return NextResponse.json({ error: { type, message } }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = loginRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const email = normalizeEmail(parsed.data.email);
  const senha = parsed.data.senha;
  const manterConectado = parsed.data.manterConectado ?? false;

  const ip = getClientIp(request);
  const emailHash = sha256Hex(email);
  const ipHash = ip ? sha256Hex(ip) : null;

  if (await estaBloqueadoPorRateLimit({ emailHash })) {
    return unauthorized(RATE_LIMIT_ERROR, 429, "rate_limited");
  }

  const usuario = await buscarUsuarioParaLogin(email);

  if (!usuario || !usuario.ativo || contaTemporariamenteBloqueada(usuario)) {
    await verifyDummyPassword(senha);
    await registrarTentativaLogin({ emailHash, ipHash, sucesso: false });
    return unauthorized(GENERIC_ERROR, 401, "unauthorized");
  }

  const senhaValida = await verifyPassword(usuario.passwordHash, senha);
  await registrarTentativaLogin({ emailHash, ipHash, sucesso: senhaValida });

  if (!senhaValida) {
    await registrarFalhaLogin(usuario);
    return unauthorized(GENERIC_ERROR, 401, "unauthorized");
  }

  await registrarLoginSucesso(usuario.id);

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  const { token } = await criarSessao({
    usuarioId: usuario.id,
    manterConectado,
    userAgent,
    ipHash,
  });

  const response = NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
  const cookie = buildSessionCookie(token, manterConectado);
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
