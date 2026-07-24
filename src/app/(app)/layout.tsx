import { AppShell } from "@/components/layout/app-shell";
import { exigirUsuario } from "@/server/auth/sessions";

// This is the real, server-side protection for every page in this route
// group — exigirUsuario() redirects to /login when there's no valid,
// DB-checked session. src/proxy.ts only does an optimistic cookie check
// beforehand to avoid an extra round-trip; it is not relied on for security.
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();

  return <AppShell usuario={usuario}>{children}</AppShell>;
}
