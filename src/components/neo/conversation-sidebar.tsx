"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquarePlus, MoreVertical, Pencil, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCreateNeoConversa,
  useDeleteNeoConversa,
  useNeoConversas,
  useRenameNeoConversa,
  type NeoConversaResumo,
} from "@/hooks/use-neo-conversas";
import { formatDateTime } from "@/lib/ui/formatting";
import { cn } from "@/lib/utils";

function ConversaItem({
  conversa,
  ativa,
  onClose,
}: {
  conversa: NeoConversaResumo;
  ativa: boolean;
  onClose: () => void;
}) {
  const [menuAberto, setMenuAberto] = React.useState(false);
  const [renomeando, setRenomeando] = React.useState(false);
  const [tituloRascunho, setTituloRascunho] = React.useState(conversa.titulo);
  const [confirmandoExclusao, setConfirmandoExclusao] = React.useState(false);
  const renomear = useRenameNeoConversa(conversa.id);
  const excluir = useDeleteNeoConversa();

  function salvarTitulo() {
    const titulo = tituloRascunho.trim();
    if (!titulo || titulo === conversa.titulo) {
      setRenomeando(false);
      return;
    }
    renomear.mutate(titulo, {
      onSuccess: () => setRenomeando(false),
      onError: () => toast.error("Não foi possível renomear a conversa."),
    });
  }

  return (
    <li className="group relative">
      {renomeando ? (
        <div className="flex items-center gap-1 px-2 py-1.5">
          <Input
            autoFocus
            value={tituloRascunho}
            onChange={(e) => setTituloRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") salvarTitulo();
              if (e.key === "Escape") setRenomeando(false);
            }}
            onBlur={salvarTitulo}
            maxLength={200}
            className="h-8 text-sm"
            aria-label="Renomear conversa"
          />
        </div>
      ) : (
        <Link
          href={`/neo/${conversa.id}`}
          onClick={onClose}
          aria-current={ativa ? "page" : undefined}
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
            ativa ? "bg-primary-bg text-primary" : "text-text-primary hover:bg-black/5",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{conversa.titulo}</span>
            <span className="block truncate text-xs text-text-secondary">{formatDateTime(conversa.atualizadoEm)}</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuAberto((v) => !v);
            }}
            className="shrink-0 rounded-md p-1 text-text-secondary opacity-0 hover:bg-black/10 focus-visible:opacity-100 group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Mais opções"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </Link>
      )}

      {menuAberto ? (
        <div className="absolute right-2 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-white py-1 shadow-md">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5"
            onClick={() => {
              setRenomeando(true);
              setMenuAberto(false);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Renomear
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-error hover:bg-error-bg"
            onClick={() => {
              setConfirmandoExclusao(true);
              setMenuAberto(false);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      ) : null}

      <AlertDialog open={confirmandoExclusao} onOpenChange={setConfirmandoExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove &quot;{conversa.titulo}&quot; e todo o seu histórico. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                excluir.mutate(conversa.id, {
                  onError: () => toast.error("Não foi possível excluir a conversa."),
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

export function ConversationSidebar({
  conversaAtivaId,
  mobileOpen,
  onCloseMobile,
}: {
  conversaAtivaId: string | undefined;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [busca, setBusca] = React.useState("");
  const { data, isLoading } = useNeoConversas(busca || undefined);
  const criar = useCreateNeoConversa();
  const router = useRouter();

  function novaConversa() {
    criar.mutate(undefined, {
      onSuccess: (conversa) => {
        onCloseMobile();
        router.push(`/neo/${conversa.id}`);
      },
      onError: () => toast.error("Não foi possível criar uma nova conversa."),
    });
  }

  return (
    <>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onCloseMobile} aria-hidden="true" />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-80 shrink-0 flex-col border-r border-border bg-white transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Conversas do Neo"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <Button onClick={novaConversa} className="flex-1 justify-start" disabled={criar.isPending}>
            <MessageSquarePlus className="h-4 w-4" /> Nova conversa
          </Button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-2 text-text-secondary hover:bg-black/5 lg:hidden"
            aria-label="Fechar lista de conversas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversas"
              className="pl-8"
              aria-label="Buscar conversas"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : data && data.data.length > 0 ? (
            <ul className="space-y-1">
              {data.data.map((conversa) => (
                <ConversaItem key={conversa.id} conversa={conversa} ativa={conversa.id === conversaAtivaId} onClose={onCloseMobile} />
              ))}
            </ul>
          ) : (
            <p className="p-4 text-center text-sm text-text-secondary">
              {busca ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda. Comece uma nova análise."}
            </p>
          )}
        </div>
      </aside>
    </>
  );
}

