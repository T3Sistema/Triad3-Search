"use client";

import { RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerView } from "@/components/neo/answer-view";
import { EtapasConcluidasList } from "@/components/neo/etapas-list";
import { normalizeNeoAnswer } from "@/lib/neo/answer";
import type { NeoMensagem } from "@/hooks/use-neo-conversas";

export function MensagemUsuario({ conteudo }: { conteudo: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-white shadow-sm sm:max-w-[70%]">
        <p className="whitespace-pre-wrap break-words">{conteudo}</p>
      </div>
    </div>
  );
}

export interface MensagemAssistenteAcoes {
  onAtualizar: () => void;
  /** Re-sends the original question as a brand-new analysis. */
  onTentarNovamente?: () => void;
  /** Starts a new analysis seeded from this one's completed steps and sources. */
  onContinuar?: () => void;
  /** Prefills the composer with the original question, letting the user edit it before resending. */
  onAjustarSolicitacao?: () => void;
}

export function MensagemAssistente({ mensagem, ...acoes }: { mensagem: NeoMensagem } & MensagemAssistenteAcoes) {
  if (mensagem.respostaEstruturada) {
    const answer = normalizeNeoAnswer(mensagem.respostaEstruturada);
    const naoConcluido = answer.status === "nao_concluido";
    return (
      <div className="space-y-2">
        <div className="rounded-2xl rounded-tl-sm border border-border bg-white p-4 shadow-sm sm:p-5">
          <AnswerView
            mensagemId={mensagem.id}
            answer={answer}
            geradoEm={mensagem.criadoEm}
            execucaoId={mensagem.execucaoId}
            onContinuar={mensagem.status === "parcial" ? acoes.onContinuar : undefined}
            onTentarNovamente={naoConcluido ? acoes.onTentarNovamente : undefined}
            onAjustarSolicitacao={naoConcluido ? acoes.onAjustarSolicitacao : undefined}
          />
        </div>
        {mensagem.status === "parcial" && !naoConcluido ? <MensagemAcoes mensagem={mensagem} {...acoes} mostrarTentarNovamente mostrarEtapas /> : null}
        {mensagem.status === "parcial" && naoConcluido && mensagem.execucaoId ? (
          <div className="w-full sm:w-auto">
            <EtapasConcluidasList execucaoId={mensagem.execucaoId} />
          </div>
        ) : null}
      </div>
    );
  }

  if (mensagem.status === "em_execucao" || mensagem.status === "pendente") {
    return (
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border border-border bg-white p-4 text-sm text-text-secondary shadow-sm">
        <span>Esta análise estava em andamento. Atualize para ver o progresso mais recente.</span>
        <Button variant="ghost" size="sm" onClick={acoes.onAtualizar}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>
    );
  }

  if (mensagem.status === "cancelada") {
    return (
      <div className="space-y-2">
        <div className="rounded-2xl rounded-tl-sm border border-border bg-slate-50 p-4 text-sm text-text-secondary shadow-sm">
          A execução foi interrompida{mensagem.conteudo ? `: ${mensagem.conteudo}` : "."}
        </div>
        <MensagemAcoes mensagem={mensagem} {...acoes} mostrarTentarNovamente mostrarEtapas />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl rounded-tl-sm border border-error/30 bg-error-bg p-4 text-sm text-text-primary shadow-sm">
        {mensagem.conteudo ?? "Não foi possível concluir esta análise."}
      </div>
      <MensagemAcoes mensagem={mensagem} {...acoes} mostrarTentarNovamente mostrarEtapas />
    </div>
  );
}

function MensagemAcoes({
  mensagem,
  onTentarNovamente,
  mostrarTentarNovamente,
  mostrarEtapas,
}: {
  mensagem: NeoMensagem;
  mostrarTentarNovamente?: boolean;
  mostrarEtapas?: boolean;
} & MensagemAssistenteAcoes) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {mostrarTentarNovamente && onTentarNovamente ? (
        <Button variant="secondary" size="sm" onClick={onTentarNovamente}>
          <RotateCcw className="h-4 w-4" /> Tentar novamente
        </Button>
      ) : null}
      {mostrarEtapas && mensagem.execucaoId ? (
        <div className="w-full sm:w-auto">
          <EtapasConcluidasList execucaoId={mensagem.execucaoId} />
        </div>
      ) : null}
    </div>
  );
}
