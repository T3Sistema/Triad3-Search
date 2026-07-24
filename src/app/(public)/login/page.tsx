import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginPage } from "@/components/pages/login-page";
import { obterSessaoAtual } from "@/server/auth/sessions";
import { sanitizeInternalPath } from "@/lib/auth/redirect-target";

export const metadata: Metadata = {
  title: "Entrar | Triad3 Search",
};

interface PageProps {
  searchParams: Promise<{ retorno?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const usuario = await obterSessaoAtual();
  if (usuario) {
    const { retorno } = await searchParams;
    redirect(sanitizeInternalPath(retorno, "/"));
  }

  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
