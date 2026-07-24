"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseNeoEvent, type NeoEvent } from "@/lib/neo/events";
import type { NeoAnswer } from "@/lib/neo/answer";
import { ApiRequestError } from "@/lib/api-client";

export interface NeoEtapaEstado {
  id: string;
  ordem: number;
  nomePublico: string;
  status: "em_execucao" | "concluida" | "falhou";
  resumo?: string;
  mensagem?: string;
}

export interface NeoConfirmacaoEstado {
  execucaoId: string;
  etapaId: string;
  nomePublico: string;
  descricao: string;
}

export type NeoStreamStatus = "idle" | "streaming" | "aguardando_confirmacao" | "concluida" | "cancelada" | "erro";

export interface NeoStreamState {
  status: NeoStreamStatus;
  execucaoId: string | null;
  mensagemId: string | null;
  objetivo: string | null;
  etapasPrevistas: string[];
  etapas: NeoEtapaEstado[];
  confirmacao: NeoConfirmacaoEstado | null;
  resposta: NeoAnswer | null;
  motivoParcial: string | null;
  erro: string | null;
}

const INITIAL_STATE: NeoStreamState = {
  status: "idle",
  execucaoId: null,
  mensagemId: null,
  objetivo: null,
  etapasPrevistas: [],
  etapas: [],
  confirmacao: null,
  resposta: null,
  motivoParcial: null,
  erro: null,
};

type Action = { type: "evento"; evento: NeoEvent } | { type: "reset" } | { type: "erro"; mensagem: string };

function reduce(state: NeoStreamState, action: Action): NeoStreamState {
  if (action.type === "reset") return INITIAL_STATE;
  if (action.type === "erro") return { ...state, status: "erro", erro: action.mensagem };

  const evento = action.evento;
  switch (evento.tipo) {
    case "execucao.iniciada":
      return { ...state, status: "streaming", execucaoId: evento.execucaoId, mensagemId: evento.mensagemId, confirmacao: null };
    case "plano.pronto":
      return { ...state, objetivo: evento.objetivo, etapasPrevistas: evento.etapasPrevistas };
    case "etapa.iniciada":
      return {
        ...state,
        etapas: [...state.etapas, { id: evento.etapaId, ordem: evento.ordem, nomePublico: evento.nomePublico, status: "em_execucao" }],
      };
    case "etapa.concluida":
      return {
        ...state,
        etapas: state.etapas.map((e) => (e.id === evento.etapaId ? { ...e, status: "concluida", resumo: evento.resumo ?? undefined } : e)),
      };
    case "etapa.falhou":
      return {
        ...state,
        etapas: state.etapas.map((e) => (e.id === evento.etapaId ? { ...e, status: "falhou", mensagem: evento.mensagem } : e)),
      };
    case "confirmacao.necessaria":
      return {
        ...state,
        status: "aguardando_confirmacao",
        confirmacao: {
          execucaoId: evento.execucaoId,
          etapaId: evento.etapaId,
          nomePublico: evento.nomePublico,
          descricao: evento.descricao,
        },
      };
    case "execucao.parcial":
      return { ...state, motivoParcial: evento.motivo };
    case "resposta.concluida":
      return { ...state, status: "concluida", resposta: evento.resposta, confirmacao: null };
    case "execucao.cancelada":
      return { ...state, status: "cancelada", confirmacao: null };
    case "execucao.falhou":
      return { ...state, status: "erro", erro: evento.mensagem, confirmacao: null };
    default:
      return state;
  }
}

async function pumpSseStream(response: Response, dispatch: React.Dispatch<Action>): Promise<void> {
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const raw = JSON.parse(line.slice(6));
        const evento = parseNeoEvent(raw);
        if (evento) dispatch({ type: "evento", evento });
      } catch {
        // Ignore malformed frames instead of breaking the whole stream.
      }
    }
  }
}

export function useNeoStream(conversaId: string | undefined) {
  const [state, dispatch] = React.useReducer(reduce, INITIAL_STATE);
  const abortRef = React.useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const refreshMensagens = React.useCallback(() => {
    if (!conversaId) return;
    queryClient.invalidateQueries({ queryKey: ["neo-mensagens", conversaId] });
    queryClient.invalidateQueries({ queryKey: ["neo-conversas"] });
    queryClient.invalidateQueries({ queryKey: ["neo-conversa", conversaId] });
  }, [conversaId, queryClient]);

  const runStream = React.useCallback(
    async (fetchIt: (signal: AbortSignal) => Promise<Response>) => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetchIt(controller.signal);
        if (!response.ok) {
          let mensagem = "Não foi possível iniciar a investigação.";
          try {
            const body = (await response.json()) as { error?: { message?: string } };
            if (body?.error?.message) mensagem = body.error.message;
          } catch {
            // ignore parse failure, keep default message
          }
          dispatch({ type: "erro", mensagem });
          return;
        }
        await pumpSseStream(response, dispatch);
        refreshMensagens();
      } catch (err) {
        if (controller.signal.aborted) return;
        const mensagem = err instanceof ApiRequestError ? err.message : "Não foi possível concluir a investigação.";
        dispatch({ type: "erro", mensagem });
      }
    },
    [refreshMensagens],
  );

  const iniciar = React.useCallback(
    (mensagem: string, idempotencyKey: string) => {
      if (!conversaId) return;
      dispatch({ type: "reset" });
      void runStream((signal) =>
        fetch(`/api/triad3/neo/conversas/${conversaId}/executar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensagem, idempotencyKey }),
          signal,
        }),
      );
    },
    [conversaId, runStream],
  );

  const confirmar = React.useCallback(
    (execucaoId: string, confirmar: boolean) => {
      void runStream((signal) =>
        fetch(`/api/triad3/neo/execucoes/${execucaoId}/confirmar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmar }),
          signal,
        }),
      );
    },
    [runStream],
  );

  const cancelar = React.useCallback(() => {
    abortRef.current?.abort();
    const execucaoId = state.execucaoId;
    if (execucaoId) {
      void fetch(`/api/triad3/neo/execucoes/${execucaoId}/cancelar`, { method: "POST" }).catch(() => {});
    }
  }, [state.execucaoId]);

  const reset = React.useCallback(() => dispatch({ type: "reset" }), []);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  return {
    state,
    iniciar,
    confirmar,
    cancelar,
    reset,
    emExecucao: state.status === "streaming" || state.status === "aguardando_confirmacao",
  };
}
