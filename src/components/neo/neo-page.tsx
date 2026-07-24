"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConversationSidebar } from "@/components/neo/conversation-sidebar";
import { Composer } from "@/components/neo/composer";
import { NeoEmptyState } from "@/components/neo/neo-empty-state";
import { MensagemAssistente, MensagemUsuario } from "@/components/neo/mensagem";
import { ExecutionProgress } from "@/components/neo/execution-progress";
import { ConfirmationCard } from "@/components/neo/confirmation-card";
import { AnswerView } from "@/components/neo/answer-view";
import { useNeoConversa, useNeoMensagens } from "@/hooks/use-neo-conversas";
import { useNeoStream } from "@/hooks/use-neo-stream";

const PENDING_KEY = "triad3:neo:pending-message";

function criarIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function NeoPage({ conversaId }: { conversaId?: string }) {
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const conversaQuery = useNeoConversa(conversaId);
  const mensagensQuery = useNeoMensagens(conversaId);
  const stream = useNeoStream(conversaId);

  const streamAtiva = stream.state.status !== "idle";

  const enviar = React.useCallback(
    (texto: string) => {
      const mensagem = texto.trim();
      if (!mensagem || !conversaId) return;
      setDraft("");
      stream.iniciar(mensagem, criarIdempotencyKey());
    },
    [conversaId, stream],
  );

  // Reuses completed steps/sources from a previous falhou/parcial execution instead of paying
  // for the same tool calls again — see buildContinuationSeed in server/neo/orchestrator.ts.
  const continuar = React.useCallback(
    (execucaoAnteriorId: string, texto: string) => {
      const mensagem = texto.trim();
      if (!mensagem || !conversaId) return;
      stream.iniciar(mensagem, criarIdempotencyKey(), execucaoAnteriorId);
    },
    [conversaId, stream],
  );

  // The real "Atualizar": pulls the server's current state (which already ran reconciliation on
  // this same GET) and drops any stale local stream state instead of trusting it forever.
  const atualizar = React.useCallback(() => {
    stream.reset();
    void mensagensQuery.refetch();
    void conversaQuery.refetch();
  }, [stream, mensagensQuery, conversaQuery]);

  // "Ajustar solicitação" (nao_concluido state): prefills the composer with the original question
  // instead of resending it verbatim, so the user can edit it before trying again.
  const ajustarSolicitacao = React.useCallback((texto: string) => {
    setDraft(texto);
  }, []);

  // Bridge from the "no conversation yet" empty state: create + navigate, then auto-send once the
  // [id] route mounts. Deferred via queueMicrotask so the send (itself a state update further down
  // the tree) doesn't run synchronously inside the effect body.
  React.useEffect(() => {
    if (!conversaId) return;
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    queueMicrotask(() => {
      try {
        const pending = JSON.parse(raw) as { conversaId: string; mensagem: string };
        if (pending.conversaId === conversaId) {
          sessionStorage.removeItem(PENDING_KEY);
          enviar(pending.mensagem);
        }
      } catch {
        // ignore malformed sessionStorage payload
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only runs once per conversaId mount, `enviar` is stable enough for this bridge.
  }, [conversaId]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagensQuery.data, stream.state.etapas.length, stream.state.resposta]);

  const criarPrimeiraConversa = React.useCallback(
    async (mensagem: string) => {
      try {
        const response = await fetch("/api/triad3/neo/conversas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!response.ok) throw new Error("failed");
        const conversa = (await response.json()) as { id: string };
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ conversaId: conversa.id, mensagem }));
        router.push(`/neo/${conversa.id}`);
      } catch {
        toast.error("Não foi possível iniciar a conversa.");
      }
    },
    [router],
  );

  if (!conversaId) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)]">
        <ConversationSidebar conversaAtivaId={undefined} mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <NeoHeader titulo={null} onOpenSidebar={() => setMobileSidebarOpen(true)} />
          <NeoEmptyState onSugestao={criarPrimeiraConversa} />
          <div className="border-t border-border bg-app-bg/60 p-4">
            <Composer
              value={draft}
              onChange={setDraft}
              onEnviar={() => draft.trim() && criarPrimeiraConversa(draft.trim())}
              onParar={() => {}}
              emExecucao={false}
            />
          </div>
        </div>
      </div>
    );
  }

  if (conversaQuery.isError) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="max-w-sm rounded-xl border border-error/30 bg-error-bg p-6 text-center">
          <p className="text-sm font-semibold text-text-primary">Conversa não encontrada</p>
          <p className="mt-1 text-sm text-text-secondary">Ela pode ter sido excluída ou pertence a outra conta.</p>
          <button type="button" onClick={() => router.push("/neo")} className="mt-3 text-sm font-medium text-primary hover:underline">
            Voltar para o Neo
          </button>
        </div>
      </div>
    );
  }

  const mensagensPersistidas = (mensagensQuery.data?.data ?? []).filter(
    (m) => !(streamAtiva && stream.state.mensagemId && m.id === stream.state.mensagemId),
  );

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      <ConversationSidebar conversaAtivaId={conversaId} mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <NeoHeader titulo={conversaQuery.data?.titulo ?? null} onOpenSidebar={() => setMobileSidebarOpen(true)} />

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {mensagensQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-white" />
              ))}
            </div>
          ) : mensagensPersistidas.length === 0 && !streamAtiva ? (
            <p className="py-10 text-center text-sm text-text-secondary">Envie uma mensagem para começar esta análise.</p>
          ) : null}

          {mensagensPersistidas.map((mensagem, index) => {
            if (mensagem.papel === "usuario") {
              return <MensagemUsuario key={mensagem.id} conteudo={mensagem.conteudo ?? ""} />;
            }
            const perguntaAnterior = [...mensagensPersistidas.slice(0, index)].reverse().find((m) => m.papel === "usuario");
            const textoAnterior = perguntaAnterior?.conteudo ?? "";
            return (
              <MensagemAssistente
                key={mensagem.id}
                mensagem={mensagem}
                onAtualizar={atualizar}
                onTentarNovamente={textoAnterior ? () => enviar(textoAnterior) : undefined}
                onContinuar={textoAnterior && mensagem.execucaoId ? () => continuar(mensagem.execucaoId!, textoAnterior) : undefined}
                onAjustarSolicitacao={textoAnterior ? () => ajustarSolicitacao(textoAnterior) : undefined}
              />
            );
          })}

          {streamAtiva ? (
            <div className="space-y-3">
              <ExecutionProgress
                objetivo={stream.state.objetivo}
                etapasPrevistas={stream.state.etapasPrevistas}
                etapas={stream.state.etapas}
                motivoParcial={stream.state.motivoParcial}
                emExecucao={stream.emExecucao}
              />

              {stream.state.confirmacao ? (
                <ConfirmationCard
                  key={stream.state.confirmacao.etapaId}
                  confirmacao={stream.state.confirmacao}
                  onConfirmar={() => stream.confirmar(stream.state.confirmacao!.execucaoId, true)}
                  onCancelar={() => stream.confirmar(stream.state.confirmacao!.execucaoId, false)}
                />
              ) : null}

              {stream.state.resposta ? (
                <div className="rounded-2xl rounded-tl-sm border border-border bg-white p-4 shadow-sm sm:p-5">
                  <AnswerView mensagemId={stream.state.mensagemId ?? ""} answer={stream.state.resposta} />
                </div>
              ) : null}

              {stream.state.status === "erro" ? (
                <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border border-error/30 bg-error-bg p-4 text-sm text-text-primary shadow-sm">
                  <span>{stream.state.erro ?? "Não foi possível concluir a análise."}</span>
                  {stream.state.conexaoPerdida ? (
                    <Button variant="ghost" size="sm" onClick={atualizar}>
                      <RefreshCw className="h-4 w-4" /> Atualizar
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {stream.state.status === "cancelada" && !stream.state.resposta ? (
                <div className="rounded-2xl rounded-tl-sm border border-border bg-slate-50 p-4 text-sm text-text-secondary shadow-sm">
                  A execução foi interrompida.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-t border-border bg-app-bg/60 p-4">
          <Composer
            value={draft}
            onChange={setDraft}
            onEnviar={() => enviar(draft)}
            onParar={stream.cancelar}
            emExecucao={stream.emExecucao}
          />
        </div>
      </div>
    </div>
  );
}

function NeoHeader({ titulo, onOpenSidebar }: { titulo: string | null; onOpenSidebar: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-white/70 px-4 py-3 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="rounded-md p-1.5 text-text-secondary hover:bg-black/5 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Abrir conversas"
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="truncate text-sm font-semibold text-text-primary">{titulo ?? "Neo"}</h1>
    </div>
  );
}
