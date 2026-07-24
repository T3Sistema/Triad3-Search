"use client";

import { Sparkles } from "lucide-react";

const SUGESTOES = [
  "Reúna um panorama completo sobre uma empresa, incluindo site oficial, notícias recentes e redes sociais.",
  "Compare duas fontes diferentes sobre o mesmo tema e aponte divergências entre elas.",
  "Mapeie um site inteiro e liste as páginas mais relevantes sobre um assunto específico.",
  "Configure um acompanhamento para avisar quando uma página específica mudar.",
];

export function NeoEmptyState({ onSugestao }: { onSugestao: (texto: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-white shadow-md">
        <Sparkles className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">Olá, eu sou o Neo.</h1>
        <p className="text-lg text-text-primary">O que vamos investigar?</p>
        <p className="text-sm text-text-secondary">
          Descreva o resultado que você quer em linguagem natural. Eu pesquiso, cruzo fontes, extraio dados,
          acompanho mudanças e monto um relatório organizado — com fontes, fatos e o que ainda não foi encontrado.
        </p>
      </div>
      <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
        {SUGESTOES.map((sugestao) => (
          <button
            key={sugestao}
            type="button"
            onClick={() => onSugestao(sugestao)}
            className="rounded-xl border border-border bg-white p-3 text-left text-sm text-text-primary shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-bg/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {sugestao}
          </button>
        ))}
      </div>
    </div>
  );
}
