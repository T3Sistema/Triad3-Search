---
paths:
  - "src/app/**/*"
  - "src/components/**/*"
  - "src/features/**/*"
  - "src/lib/ui/**/*"
  - "public/**/*"
---

# Regras de produto do frontend — Triad3 Search

Estas regras se aplicam a tudo que é renderizado ou executado no navegador. Elas são permanentes:
não as remova, não as contorne "só desta vez", e não as enfraqueça para resolver um bug pontual.

## 1. Idioma

- Todo texto visível ao usuário deve estar em português do Brasil: sidebar, topbar, títulos,
  subtítulos, descrições, labels, placeholders, botões, abas, tooltips, modais, confirmações,
  mensagens de erro/sucesso, estados vazios/carregamento, toasts, paginação, tabelas, filtros,
  formulários, validações, alertas, badges, cronogramas, `title`, `aria-label`, textos vindos de
  enums/status retornados pelo backend, nomes de arquivos exportados.
- O nome próprio `Triad3 Search` nunca é traduzido.
- Termos técnicos universais podem permanecer em inglês (API, URL, JSON, HTML, CSV, Markdown,
  Webhook, JavaScript, cURL) — mas a explicação ao redor deles deve estar em português.
- Nunca renderize diretamente um valor de status/enum cru vindo da API. Traduza sempre através de
  `src/lib/ui/status-labels.ts` (`translateStatus`, `translateService`, `toneForStatus`). Se um novo
  status/serviço aparecer, adicione-o ao mapa em vez de deixá-lo cair no fallback bruto.
- Datas usam `src/lib/ui/formatting.ts` (`formatDateTime`, baseado em
  `new Intl.DateTimeFormat("pt-BR")`). Números usam `formatNumber`/`formatMilliseconds` (baseados em
  `new Intl.NumberFormat("pt-BR")`). Não formate datas/números manualmente em componentes novos.
- Nomes visíveis dos módulos: Scrape→Capturar, Extract→Extrair, Search→Pesquisar, Crawl→Mapear site,
  Monitor→Monitorar, History→Histórico, Credits→Créditos, Documentation→Ajuda. Nomes técnicos
  internos (componentes, hooks, tipos, chaves de rota) podem continuar em inglês quando isso evita
  refatoração desnecessária — a exigência é sobre o que é exibido, não sobre identificadores internos.

## 2. Identidade visual

- Fundo global obrigatório: `#DBE2E9` (Blue-Grey). Ele deve aparecer de forma clara na área principal
  do sistema, não só em detalhes pequenos.
- Sidebar e topbar: brancas ou `#F8FAFC`. Cards, formulários, tabelas, modais, drawers e campos:
  fundo branco.
- Cor primária (`#2563EB`) só para ações e destaques — nunca como fundo predominante.
- A interface é exclusivamente clara: nenhuma tela predominantemente escura, nenhum visualizador de
  JSON/HTML/Markdown/cURL com tema escuro, nenhuma classe `dark:` habilitando aparência escura.
  `color-scheme: light` deve continuar definido em `globals.css`. Não implemente alternância de tema.
- Os tokens de cor vivem em `src/app/globals.css` (`@theme inline`). Ao adicionar um token novo,
  mantenha os valores já definidos — não introduza uma paleta paralela.

## 3. Neutralização de fornecedores (regra permanente e não negociável)

- O frontend só pode mostrar a marca `Triad3 Search`. Nunca nome, logotipo, domínio, endpoint,
  header de autenticação, sigla ou link de documentação de um fornecedor/provedor externo.
- Lista atual de termos proibidos no frontend, mantida em `scripts/ui-policy.config.mjs`
  (`forbiddenFrontendTerms`): `ScrapeGraphAI`, `scrapegraphai`, `Scrape Graph AI`, `SGAI`,
  `v2-api.scrapegraphai.com`. **Toda nova integração deve adicionar seus próprios identificadores a
  essa lista no mesmo PR que a introduz.**
- Substituições neutras padrão: "API conectada"→"Serviço conectado", "API V2"→"Motor de
  inteligência", "Status da API"→"Status do serviço", "Documentação da API"→"Ajuda", "Chave da API
  inválida"→"A integração não está configurada corretamente", "Provedor retornou erro"→"O serviço não
  conseguiu processar a solicitação".
- **Exceção obrigatória:** conteúdo legítimo coletado de uma página/pesquisa feita pelo próprio
  usuário nunca é censurado ou alterado, mesmo que contenha nomes de empresas ou fornecedores. A
  proibição vale apenas para a interface, textos do sistema e mensagens técnicas do Triad3 Search —
  nunca para o resultado da pesquisa em si.

## 4. Arquitetura server-only

- A integração externa vive isolada em `src/server/integrations/web-intelligence/`
  (`client.ts`, `errors.ts`, `types.ts`, `sanitize.ts`). `client.ts` importa `"server-only"` no topo.
- Nenhum componente com `"use client"` pode importar: o cliente do fornecedor, sua configuração, base
  URL externa, headers externos, chaves, ou qualquer tipo/função que exponha mensagens externas sem
  sanitização.
- Zod schemas e tipos de formato compartilhados entre client e server (sem segredos, sem branding)
  ficam em `src/lib/integration/` (`formats.ts`, `schemas.ts`, `render-helpers.ts`) — seguros para o
  bundle do navegador.
- Rotas internas expostas ao frontend usam nomes neutros em português sob `/api/triad3/*`
  (`capturar`, `extrair`, `pesquisar`, `mapear`, `monitoramentos`, `historico`, `creditos`, `schema`).
  A URL externa real só existe dentro de `src/server/integrations/web-intelligence/client.ts`.
- O preview de requisição e o cURL exibidos na UI (`RequestPreview`, `ResultToolbar`, `src/lib/curl.ts`)
  mostram **apenas** a rota interna neutra — nunca o domínio externo, header ou chave reais.

## 5. Sanitização de erros

- Mensagens técnicas vindas da integração passam por
  `src/server/integrations/web-intelligence/sanitize.ts` (`sanitizeIntegrationError`) antes de
  entrarem em qualquer resposta enviada ao navegador. Essa função traduz frases conhecidas
  (unauthorized, payment required, rate limit, timeout, internal server error) para uma frase segura
  em português e descarta qualquer coisa que ainda pareça conter nome de fornecedor, domínio ou header
  de autenticação.
- `src/server/integrations/web-intelligence/errors.ts` mantém as mensagens padrão por tipo de erro
  (`PT_BR_MESSAGES`) sempre neutras — nunca mencione o fornecedor ali.
- **Nunca** aplique essa sanitização ao conteúdo que o próprio usuário buscou/capturou — só a erros e
  mensagens de infraestrutura.

## 6. Checklist obrigatório antes de qualquer commit de frontend

1. `npm run check:ui-policy` — sem violações.
2. `npm run lint` e `npm run typecheck` — sem erros.
3. `npm run test` — sem regressões (sem consumir créditos reais).
4. Releia os textos alterados: estão em português? Nenhum termo da lista proibida apareceu? Datas e
   números usam os helpers de `src/lib/ui/formatting.ts`? Status usam `src/lib/ui/status-labels.ts`?
5. Se você tocou em `next.config`, rotas, ou build: rode `npm run build` e confirme que
   `npm run check:ui-policy:static` (verificação de `.next/static`) também passa.
