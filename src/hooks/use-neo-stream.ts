"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseNeoEvent, type NeoEvent } from "@/lib/neo/events";
import type { NeoAnswer } from "@/lib/neo/answer";
import type { NeoClarificationForm, NeoFormularioValores } from "@/lib/neo/clarification-form";
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

export interface NeoFormularioEstado {
  execucaoId: string;
  mensagemId: string;
  formulario: NeoClarificationForm;
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
  formulario: NeoFormularioEstado | null;
  resposta: NeoAnswer | null;
  /** A plain conversational reply or clarifying question — never wrapped in the full relatório structure. */
  respostaTexto: string | null;
  motivoParcial: string | null;
  erro: string | null;
  /** True only when the stream itself stalled (no data at all for a while) — distinct from a normal `erro` the server reported. Lets the UI point the user at "Atualizar" instead of implying the investigation itself failed. */
  conexaoPerdida: boolean;
}

const INITIAL_STATE: NeoStreamState = {
  status: "idle",
  execucaoId: null,
  mensagemId: null,
  objetivo: null,
  etapasPrevistas: [],
  etapas: [],
  confirmacao: null,
  formulario: null,
  resposta: null,
  respostaTexto: null,
  motivoParcial: null,
  erro: null,
  conexaoPerdida: false,
};

/**
 * No new data (not even a heartbeat) for this long means the connection is
 * stalled — comfortably larger than NEO_LIMITS.heartbeatIntervalMs (12s) on
 * the server, so normal jitter never trips it.
 */
const WATCHDOG_TIMEOUT_MS = 30_000;
const WATCHDOG_CHECK_INTERVAL_MS = 5_000;

type Action = { type: "evento"; evento: NeoEvent } | { type: "reset" } | { type: "erro"; mensagem: string } | { type: "conexao_perdida" };

function reduce(state: NeoStreamState, action: Action): NeoStreamState {
  if (action.type === "reset") return INITIAL_STATE;
  if (action.type === "erro") return { ...state, status: "erro", erro: action.mensagem, conexaoPerdida: false };
  if (action.type === "conexao_perdida") {
    return {
      ...state,
      status: "erro",
      erro: "A conexão com o Neo foi perdida. Atualize para ver o estado mais recente.",
      conexaoPerdida: true,
    };
  }

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
    case "formulario.necessario":
      return {
        ...state,
        status: "aguardando_confirmacao",
        formulario: { execucaoId: evento.execucaoId, mensagemId: evento.mensagemId, formulario: evento.formulario },
      };
    case "execucao.parcial":
      return { ...state, motivoParcial: evento.motivo };
    case "resposta.concluida":
      return { ...state, status: "concluida", resposta: evento.resposta, confirmacao: null, formulario: null };
    case "resposta.mensagem":
      return { ...state, status: "concluida", respostaTexto: evento.texto, confirmacao: null, formulario: null };
    case "execucao.cancelada":
      return { ...state, status: "cancelada", confirmacao: null, formulario: null };
    case "execucao.falhou":
      return { ...state, status: "erro", erro: evento.mensagem, confirmacao: null, formulario: null, conexaoPerdida: false };
    case "heartbeat":
      return state;
    default:
      return state;
  }
}

async function pumpSseStream(response: Response, dispatch: React.Dispatch<Action>, onActivity: () => void): Promise<void> {
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onActivity();
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
      const lastActivityAt = { current: Date.now() };
      const watchdog = setInterval(() => {
        if (Date.now() - lastActivityAt.current > WATCHDOG_TIMEOUT_MS) {
          dispatch({ type: "conexao_perdida" });
          controller.abort();
          // A stalled stream never produced a terminal event — pull the real
          // state from the server instead of leaving the UI guessing.
          refreshMensagens();
        }
      }, WATCHDOG_CHECK_INTERVAL_MS);
      try {
        const response = await fetchIt(controller.signal);
        if (!response.ok) {
          let mensagem = "Não foi possível iniciar a análise.";
          try {
            const body = (await response.json()) as { error?: { message?: string } };
            if (body?.error?.message) mensagem = body.error.message;
          } catch {
            // ignore parse failure, keep default message
          }
          dispatch({ type: "erro", mensagem });
          return;
        }
        await pumpSseStream(response, dispatch, () => {
          lastActivityAt.current = Date.now();
        });
        refreshMensagens();
      } catch (err) {
        if (controller.signal.aborted) return;
        const mensagem = err instanceof ApiRequestError ? err.message : "Não foi possível concluir a análise.";
        dispatch({ type: "erro", mensagem });
      } finally {
        clearInterval(watchdog);
      }
    },
    [refreshMensagens],
  );

  const iniciar = React.useCallback(
    (mensagem: string, idempotencyKey: string, continuarExecucaoId?: string) => {
      if (!conversaId) return;
      dispatch({ type: "reset" });
      void runStream((signal) =>
        fetch(`/api/triad3/neo/conversas/${conversaId}/executar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensagem, idempotencyKey, continuarExecucaoId }),
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

  const enviarFormulario = React.useCallback(
    (execucaoId: string, valores: NeoFormularioValores) => {
      void runStream((signal) =>
        fetch(`/api/triad3/neo/execucoes/${execucaoId}/formulario`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ valores }),
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
    enviarFormulario,
    cancelar,
    reset,
    emExecucao: state.status === "streaming" || state.status === "aguardando_confirmacao",
  };
}
