import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Autenticação real ainda não existe neste projeto (ver auditoria no PR).
 * Por isso este proxy, por ora, apenas envia a rota inicial para `/login`
 * — ele NÃO protege as demais páginas do painel, para não simular uma
 * proteção que não existe de fato. Quando uma solução de autenticação for
 * definida, a verificação de sessão deve entrar aqui, cobrindo o matcher
 * abaixo (que já exclui API e assets estáticos).
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|branding/).*)"],
};
