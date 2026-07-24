"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

export interface NeoConversaResumo {
  id: string;
  usuarioId: string;
  titulo: string;
  resumoContexto: string | null;
  status: "ativa" | "arquivada";
  criadoEm: string;
  atualizadoEm: string;
}

export interface NeoMensagem {
  id: string;
  conversaId: string;
  usuarioId: string;
  papel: "usuario" | "assistente" | "sistema";
  conteudo: string | null;
  respostaEstruturada: unknown;
  status: "pendente" | "em_execucao" | "concluida" | "parcial" | "falhou" | "cancelada";
  execucaoId: string | null;
  criadoEm: string;
}

const CONVERSAS_KEY = ["neo-conversas"] as const;

export function useNeoConversas(busca?: string) {
  return useQuery({
    queryKey: [...CONVERSAS_KEY, busca ?? ""],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      return apiGet<{ data: NeoConversaResumo[] }>(`/api/triad3/neo/conversas?${params.toString()}`, signal);
    },
  });
}

export function useNeoConversa(id: string | undefined) {
  return useQuery({
    queryKey: ["neo-conversa", id],
    queryFn: ({ signal }) => apiGet<NeoConversaResumo>(`/api/triad3/neo/conversas/${id}`, signal),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useNeoMensagens(conversaId: string | undefined) {
  return useQuery({
    queryKey: ["neo-mensagens", conversaId],
    queryFn: ({ signal }) => apiGet<{ data: NeoMensagem[] }>(`/api/triad3/neo/conversas/${conversaId}/mensagens`, signal),
    enabled: Boolean(conversaId),
  });
}

export interface NeoExecucaoEtapa {
  id: string;
  ordem: number;
  tipo: string;
  nomePublico: string;
  status: string;
  erroPublico: string | null;
}

export interface NeoExecucaoDetalhe {
  id: string;
  conversaId: string;
  status: string;
  camposSolicitados: unknown;
  camposEncontrados: unknown;
  camposAusentes: unknown;
  erroPublico: string | null;
  iniciadoEm: string;
  concluidoEm: string | null;
  canceladoEm: string | null;
  etapas: NeoExecucaoEtapa[];
}

/** Only fetched on demand (e.g. "Ver etapas concluídas") — the live progress panel already covers the streaming case. */
export function useNeoExecucao(execucaoId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["neo-execucao", execucaoId],
    queryFn: ({ signal }) => apiGet<NeoExecucaoDetalhe>(`/api/triad3/neo/execucoes/${execucaoId}`, signal),
    enabled: Boolean(execucaoId) && (options.enabled ?? true),
  });
}

export function useCreateNeoConversa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (titulo?: string) => apiPost<NeoConversaResumo>("/api/triad3/neo/conversas", { titulo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSAS_KEY }),
  });
}

export function useRenameNeoConversa(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (titulo: string) => apiPatch<NeoConversaResumo>(`/api/triad3/neo/conversas/${id}`, { titulo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSAS_KEY });
      queryClient.invalidateQueries({ queryKey: ["neo-conversa", id] });
    },
  });
}

export function useDeleteNeoConversa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/triad3/neo/conversas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSAS_KEY }),
  });
}
