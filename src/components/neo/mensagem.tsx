"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerView } from "@/components/neo/answer-view";
import { neoAnswerSchema } from "@/lib/neo/answer";
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

export function MensagemAssistente({ mensagem, onAtualizar }: { mensagem: NeoMensagem; onAtualizar: () => void }) {
  if (mensagem.respostaEstruturada) {
    const parsed = neoAnswerSchema.safeParse(mensagem.respostaEstruturada);
    if (parsed.success) {
      return (
        <div className="rounded-2xl rounded-tl-sm border border-border bg-white p-4 shadow-sm sm:p-5">
          <AnswerView mensagemId={mensagem.id} answer={parsed.data} />
        </div>
      );
    }
  }

  if (mensagem.status === "em_execucao" || mensagem.status === "pendente") {
    return (
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border border-border bg-white p-4 text-sm text-text-secondary shadow-sm">
        <span>Esta investigação estava em andamento. Atualize para ver o progresso mais recente.</span>
        <Button variant="ghost" size="sm" onClick={onAtualizar}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>
    );
  }

  if (mensagem.status === "cancelada") {
    return (
      <div className="rounded-2xl rounded-tl-sm border border-border bg-slate-50 p-4 text-sm text-text-secondary shadow-sm">
        A execução foi interrompida{mensagem.conteudo ? `: ${mensagem.conteudo}` : "."}
      </div>
    );
  }

  return (
    <div className="rounded-2xl rounded-tl-sm border border-error/30 bg-error-bg p-4 text-sm text-text-primary shadow-sm">
      {mensagem.conteudo ?? "Não foi possível concluir esta investigação."}
    </div>
  );
}
