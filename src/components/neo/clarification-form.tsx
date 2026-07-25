"use client";

import * as React from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { NeoClarificationForm, NeoFormularioValores } from "@/lib/neo/clarification-form";

function initialValues(formulario: NeoClarificationForm): NeoFormularioValores {
  const valores: NeoFormularioValores = {};
  for (const campo of formulario.campos) {
    if (campo.tipo === "multipla_selecao") {
      valores[campo.id] = campo.valorSugerido ? [campo.valorSugerido] : [];
    } else if (campo.tipo === "alternancia") {
      valores[campo.id] = campo.valorSugerido === "true";
    } else {
      valores[campo.id] = campo.valorSugerido ?? "";
    }
  }
  return valores;
}

function isCampoPreenchido(valor: string | string[] | boolean | undefined): boolean {
  if (typeof valor === "boolean") return true;
  if (Array.isArray(valor)) return valor.length > 0;
  return Boolean(valor && valor.trim());
}

/** Render with `key={mensagemId}` at the call site so a new formulário always mounts fresh. */
export function ClarificationFormCard({
  formulario,
  onEnviar,
}: {
  formulario: NeoClarificationForm;
  onEnviar: (valores: NeoFormularioValores) => void;
}) {
  const [valores, setValores] = React.useState<NeoFormularioValores>(() => initialValues(formulario));
  const [enviando, setEnviando] = React.useState(false);

  const camposObrigatoriosFaltando = formulario.campos.some((campo) => campo.obrigatorio && !isCampoPreenchido(valores[campo.id]));

  function setValor(id: string, valor: string | string[] | boolean) {
    setValores((atual) => ({ ...atual, [id]: valor }));
  }

  function handleEnviar() {
    setEnviando(true);
    onEnviar(valores);
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary-bg/40 p-4">
      <div className="flex items-start gap-3">
        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{formulario.titulo}</p>
          <p className="mt-1 text-sm text-text-secondary">{formulario.explicacao}</p>

          <div className="mt-4 space-y-4">
            {formulario.campos.map((campo) => (
              <div key={campo.id} className="space-y-1.5">
                <Label htmlFor={campo.id}>
                  {campo.rotulo}
                  {campo.obrigatorio ? <span className="text-error"> *</span> : null}
                </Label>
                {campo.descricao ? <p className="text-xs text-text-secondary">{campo.descricao}</p> : null}

                {campo.tipo === "area_texto" ? (
                  <Textarea
                    id={campo.id}
                    value={(valores[campo.id] as string) ?? ""}
                    onChange={(e) => setValor(campo.id, e.target.value)}
                    disabled={enviando}
                  />
                ) : campo.tipo === "alternancia" ? (
                  <Switch
                    id={campo.id}
                    checked={Boolean(valores[campo.id])}
                    onCheckedChange={(checked) => setValor(campo.id, checked)}
                    disabled={enviando}
                  />
                ) : campo.tipo === "selecao" ? (
                  <Select value={(valores[campo.id] as string) ?? ""} onValueChange={(v) => setValor(campo.id, v)} disabled={enviando}>
                    <SelectTrigger id={campo.id}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {campo.opcoes.map((opcao) => (
                        <SelectItem key={opcao.valor} value={opcao.valor}>
                          {opcao.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : campo.tipo === "multipla_selecao" ? (
                  <div className="space-y-2">
                    {campo.opcoes.map((opcao) => {
                      const selecionadas = (valores[campo.id] as string[]) ?? [];
                      const marcado = selecionadas.includes(opcao.valor);
                      return (
                        <label key={opcao.valor} className="flex items-center gap-2 text-sm text-text-primary">
                          <Checkbox
                            checked={marcado}
                            disabled={enviando}
                            onCheckedChange={(checked) =>
                              setValor(campo.id, checked ? [...selecionadas, opcao.valor] : selecionadas.filter((v) => v !== opcao.valor))
                            }
                          />
                          {opcao.rotulo}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <Input
                    id={campo.id}
                    type={campo.tipo === "url" ? "url" : campo.tipo === "numero" ? "number" : campo.tipo === "data" ? "date" : "text"}
                    value={(valores[campo.id] as string) ?? ""}
                    onChange={(e) => setValor(campo.id, e.target.value)}
                    disabled={enviando}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Button size="sm" onClick={handleEnviar} disabled={enviando || camposObrigatoriosFaltando}>
              {formulario.acaoConfirmacao}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
