"use client";

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCredits } from "@/hooks/use-credits";

export function SettingsInfoDialog() {
  const { data: credits } = useCredits();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Configurações" title="Configurações">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>
            Informações sobre a conexão com o serviço. Não é possível informar uma chave por aqui — a
            configuração da integração vive apenas no servidor.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-text-secondary">Autenticação</dt>
          <dd className="text-text-primary">Aplicada apenas no backend</dd>

          <dt className="text-text-secondary">Plano</dt>
          <dd className="text-text-primary">{credits?.plan ?? "—"}</dd>
        </dl>

        <p className="rounded-lg border border-border bg-slate-50 p-3 text-xs text-text-secondary">
          Para alterar a integração, atualize as variáveis de ambiente do servidor (ou nas variáveis de
          ambiente do projeto na Vercel) e faça um novo deploy. Elas nunca são expostas ao navegador.
        </p>
      </DialogContent>
    </Dialog>
  );
}
