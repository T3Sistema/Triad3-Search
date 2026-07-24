"use client";

import { AlertTriangle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FetchConfig, FetchMode } from "@/lib/integration/formats";
import { validateJson } from "@/lib/json-utils";

export interface FetchConfigFormValue {
  mode: FetchMode;
  stealth: boolean;
  headersRaw: string;
  cookiesRaw: string;
  scrolls: number;
  wait: number;
  timeout: number;
  country: string;
}

export const DEFAULT_FETCH_CONFIG_FORM: FetchConfigFormValue = {
  mode: "auto",
  stealth: false,
  headersRaw: "",
  cookiesRaw: "",
  scrolls: 0,
  wait: 0,
  timeout: 30000,
  country: "",
};

/** Converts the form's raw-text state into the API payload shape, dropping invalid/empty fields. */
export function toFetchConfigPayload(value: FetchConfigFormValue): FetchConfig | undefined {
  const headers = parseJsonRecord(value.headersRaw);
  const cookies = parseJsonRecord(value.cookiesRaw);
  const config: FetchConfig = {
    mode: value.mode,
    stealth: value.stealth || undefined,
    headers,
    cookies,
    scrolls: value.scrolls > 0 ? value.scrolls : undefined,
    wait: value.wait > 0 ? value.wait : undefined,
    timeout: value.timeout,
    country: value.country ? value.country.toLowerCase() : undefined,
  };
  return config;
}

function parseJsonRecord(raw: string): Record<string, string> | undefined {
  const result = validateJson(raw);
  if (!result.valid || !result.value || typeof result.value !== "object") return undefined;
  return result.value as Record<string, string>;
}

interface FetchConfigAccordionProps {
  value: FetchConfigFormValue;
  onChange: (value: FetchConfigFormValue) => void;
  idPrefix: string;
}

export function FetchConfigAccordion({ value, onChange, idPrefix }: FetchConfigAccordionProps) {
  const headersValidation = validateJson(value.headersRaw);
  const cookiesValidation = validateJson(value.cookiesRaw);

  return (
    <Accordion type="single" collapsible className="rounded-lg border border-border bg-white px-4">
      <AccordionItem value="fetch-config">
        <AccordionTrigger>Configurações avançadas de captura</AccordionTrigger>
        <AccordionContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-mode`}>Modo de captura</Label>
              <Select value={value.mode} onValueChange={(mode) => onChange({ ...value, mode: mode as FetchMode })}>
                <SelectTrigger id={`${idPrefix}-mode`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="fast">Rápido</SelectItem>
                  <SelectItem value="js">Com JavaScript</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-country`}>País (código ISO de 2 letras)</Label>
              <Input
                id={`${idPrefix}-country`}
                value={value.country}
                onChange={(e) => onChange({ ...value, country: e.target.value.slice(0, 2) })}
                placeholder="br"
                maxLength={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-scrolls`}>Rolagens (scrolls) — 0 a 100</Label>
              <Input
                id={`${idPrefix}-scrolls`}
                type="number"
                min={0}
                max={100}
                value={value.scrolls}
                onChange={(e) => onChange({ ...value, scrolls: clamp(Number(e.target.value), 0, 100) })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-wait`}>Espera (wait) em ms — 0 a 30000</Label>
              <Input
                id={`${idPrefix}-wait`}
                type="number"
                min={0}
                max={30000}
                value={value.wait}
                onChange={(e) => onChange({ ...value, wait: clamp(Number(e.target.value), 0, 30000) })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-timeout`}>Timeout em ms — 1000 a 60000</Label>
              <Input
                id={`${idPrefix}-timeout`}
                type="number"
                min={1000}
                max={60000}
                value={value.timeout}
                onChange={(e) => onChange({ ...value, timeout: clamp(Number(e.target.value), 1000, 60000) })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <Label htmlFor={`${idPrefix}-stealth`}>Modo furtivo (stealth)</Label>
                <p className="text-xs text-text-secondary">Reduz a chance de bloqueio por anti-bot.</p>
              </div>
              <Switch
                id={`${idPrefix}-stealth`}
                checked={value.stealth}
                onCheckedChange={(stealth) => onChange({ ...value, stealth })}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-bg p-2.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Headers e cookies informados abaixo são enviados ao serviço externo junto da requisição.
              Nunca são salvos no navegador nem aparecem em logs.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-headers`}>Headers customizados (JSON)</Label>
              <Textarea
                id={`${idPrefix}-headers`}
                value={value.headersRaw}
                onChange={(e) => onChange({ ...value, headersRaw: e.target.value })}
                placeholder='{ "X-Custom": "valor" }'
                rows={4}
                aria-invalid={!headersValidation.valid}
              />
              {!headersValidation.valid && value.headersRaw.trim() && (
                <p className="text-xs text-error">JSON inválido: {headersValidation.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-cookies`}>Cookies customizados (JSON)</Label>
              <Textarea
                id={`${idPrefix}-cookies`}
                value={value.cookiesRaw}
                onChange={(e) => onChange({ ...value, cookiesRaw: e.target.value })}
                placeholder='{ "session": "valor" }'
                rows={4}
                aria-invalid={!cookiesValidation.valid}
              />
              {!cookiesValidation.valid && value.cookiesRaw.trim() && (
                <p className="text-xs text-error">JSON inválido: {cookiesValidation.message}</p>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
