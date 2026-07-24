"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = React.useState(false);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/triad3/sessao/sair", { method: "POST" });
    } finally {
      // Hard navigation: discards all client-side state/cache along with the
      // now-invalid session, guaranteeing a fresh, unauthenticated render.
      window.location.href = "/login";
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Sair"
      title="Sair"
      onClick={handleLogout}
      disabled={pending}
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
