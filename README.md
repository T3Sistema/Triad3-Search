# Triad3 Search

Painel de operação para a **API V2 da ScrapeGraphAI**, com identidade visual própria (Triad3 Search).
Organizado como o Playground da ScrapeGraphAI (Scrape, Extract, Search, Crawl, Monitor + Histórico e
Créditos), mas sem nenhum código, texto ou logotipo proprietário — apenas a lógica funcional
reproduzida com marca própria.

Este é um projeto **funcional**, não uma demonstração: todas as ferramentas fazem chamadas reais à
API da ScrapeGraphAI através do backend deste projeto.

## Regras de segurança importantes

- **Não há login nem cadastro.** Qualquer pessoa com acesso ao endereço público deste painel pode
  disparar requisições e consumir os créditos configurados no servidor. Se isso for um problema,
  restrinja o acesso à URL por outro meio (VPN, proxy autenticado, IP allowlist etc.) — este projeto
  não implementa autenticação por decisão de escopo.
- A chave `SGAI_API_KEY` **nunca** é enviada ao navegador. Toda comunicação com
  `https://v2-api.scrapegraphai.com` passa pelas rotas internas em `src/app/api/sgai/*`, que rodam
  apenas no servidor (`export const runtime = "nodejs"`).
- Não existe um proxy genérico: cada rota interna é específica, valida o payload com Zod e só chama
  o endpoint correspondente da ScrapeGraphAI.
- Headers/cookies customizados (configurações avançadas de captura) nunca são persistidos no
  navegador e nunca aparecem em logs do servidor — apenas `{ id, endpoint, status, durationMs }` é
  registrado por chamada.

## Stack

- Next.js (App Router) + TypeScript (`strict`)
- Tailwind CSS v4 (paleta clara própria, sem tema escuro)
- Componentes estilo shadcn/ui construídos sobre Radix UI
- Lucide Icons
- React Hook Form + Zod
- TanStack Query (v5)
- `react-markdown` + `rehype-sanitize` (Markdown sanitizado), `react-syntax-highlighter` (código) e
  `react-json-view-lite` (árvore JSON)
- Vitest para testes

## Como rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha SGAI_API_KEY com uma chave real
npm run dev
```

Abra `http://localhost:3000` — a rota `/` já abre o painel (ferramenta Scrape).

## Variáveis de ambiente

```env
SGAI_API_KEY=
SGAI_BASE_URL=https://v2-api.scrapegraphai.com
NEXT_PUBLIC_APP_NAME=Triad3 Search
```

- `SGAI_API_KEY`: obrigatória. Lida apenas em `src/lib/scrapegraph/client.ts`, no servidor. Se estiver
  ausente, todas as rotas retornam um erro amigável (`{"error":{"type":"configuration", ...}}`) em vez
  de quebrar o painel.
- `SGAI_BASE_URL`: opcional, padrão `https://v2-api.scrapegraphai.com`.
- `NEXT_PUBLIC_APP_NAME`: opcional, usado apenas no `<title>` da página (não contém segredo).

Nunca use o prefixo `NEXT_PUBLIC_` para a chave da API — isso a exporia no navegador.

## Scripts

```bash
npm run dev         # desenvolvimento
npm run build        # build de produção
npm run start         # servidor de produção (após build)
npm run lint          # ESLint (inclui regras do React Compiler)
npm run typecheck     # tsc --noEmit
npm run test           # testes unitários (Vitest), sem consumir créditos reais
```

### Testes ao vivo (opcionais, consomem créditos reais)

Por padrão nenhum teste chama a API real. Para validar manualmente contra a API de verdade, defina:

```env
RUN_LIVE_TESTS=true
SGAI_API_KEY=sua-chave-real
```

Com essas variáveis definidas, use primeiro `GET /api/sgai/credits` para confirmar a conexão e, no
máximo, uma operação barata de Scrape contra `https://example.com` antes de qualquer teste mais amplo.
Sem essas variáveis, nenhuma chamada real é feita.

## Deploy na Vercel

1. Importe este repositório na Vercel.
2. Abra **Project Settings → Environment Variables**.
3. Cadastre:
   ```env
   SGAI_API_KEY=chave_real
   SGAI_BASE_URL=https://v2-api.scrapegraphai.com
   NEXT_PUBLIC_APP_NAME=Triad3 Search
   ```
4. Marque a chave para os ambientes necessários (Production / Preview / Development).
5. Faça um novo deploy.
6. Nunca commite a chave real no Git nem a exponha como `NEXT_PUBLIC_*`.

As rotas que consultam a ScrapeGraphAI usam `export const runtime = "nodejs"`,
`export const dynamic = "force-dynamic"`, `cache: "no-store"` nas chamadas de saída e
`Cache-Control: no-store` nas respostas. Rotas que podem demorar mais (Scrape, Extract, Search, Crawl)
declaram `export const maxDuration = 60`; ajuste esse valor conforme o plano da Vercel, se necessário.

## Estrutura principal

```
src/
  app/
    page.tsx                     # "/" — Scrape (painel abre direto aqui)
    extract/page.tsx
    search/page.tsx
    crawl/page.tsx                # criar crawl
    crawl/[id]/page.tsx            # acompanhar/gerenciar um crawl
    monitor/page.tsx               # criar monitor + "meus monitores"
    monitor/[id]/page.tsx          # detalhe + atividade
    history/page.tsx
    history/[id]/page.tsx
    docs/page.tsx                  # documentação interna do painel
    api/sgai/
      scrape/route.ts
      extract/route.ts
      search/route.ts
      crawl/route.ts, crawl/[id]/route.ts, crawl/[id]/pages/route.ts,
      crawl/[id]/stop/route.ts, crawl/[id]/resume/route.ts
      monitor/route.ts, monitor/[id]/route.ts, monitor/[id]/pause/route.ts,
      monitor/[id]/resume/route.ts, monitor/[id]/activity/route.ts
      history/route.ts, history/[id]/route.ts
      credits/route.ts
      schema/route.ts               # gerador de schema com IA (opcional/best-effort)
  components/
    layout/                        # Sidebar, Topbar, AppShell, créditos, status de conexão
    playground/                    # FormatSelector, FetchConfigAccordion, SchemaEditor, RequestPreview
    viewer/                        # JsonTree, JsonCode, Markdown, HtmlSource, Links, Imagens,
                                    # Screenshot, SearchResults, Metadata, Error, Loading, Empty
    pages/                          # componentes de página (Scrape/Extract/Search/Crawl/Monitor/History)
    ui/                             # primitivos estilo shadcn (Radix + Tailwind)
  hooks/                           # hooks TanStack Query por serviço
  lib/
    scrapegraph/
      client.ts                    # cliente central da API (timeout, retry, logging seguro)
      schemas.ts                   # Zod para cada payload de requisição
      formats.ts                   # formatos compartilhados (Scrape/Crawl/Monitor) + FetchConfig
      errors.ts                    # normalização de erros + mensagens em pt-BR
      types.ts                     # tipos "passthrough" para as respostas
    api-utils.ts                    # helpers de resposta, checagem de Origin, limite de payload
```

## Sobre a documentação oficial da ScrapeGraphAI

Os payloads e endpoints implementados seguem a especificação fornecida para este projeto (Base URL
`https://v2-api.scrapegraphai.com`, prefixo `/api`, header `SGAI-APIKEY`). No momento da implementação,
`docs.scrapegraphai.com` bloqueou o acesso automatizado direto (HTTP 403) às páginas de referência
específicas de cada endpoint; a estrutura de payload usada aqui foi confirmada via busca (que validou
Base URL, prefixo e o formato do array `formats[]`) e via a especificação repassada para este projeto,
que reflete a documentação oficial. Todas as respostas são tratadas como **passthrough** (`.passthrough()`
no Zod / tipos com índice de assinatura aberta) — nenhum campo desconhecido é descartado, e a aba
"JSON" sempre mostra o payload original completo. Caso a ScrapeGraphAI altere nomes de propriedades em
uma versão futura da API, ajuste os schemas em `src/lib/scrapegraph/schemas.ts` e os tipos em
`src/lib/scrapegraph/types.ts` — a UI não quebra com campos novos ou ausentes graças ao passthrough.

## Limitações conhecidas

- O endpoint opcional `POST /schema` (gerador de schema por IA) é chamado de forma best-effort: se a
  sua versão/plano não o expuser, o editor de schema manual continua funcionando normalmente e a UI
  mostra "Gerador automático de schema indisponível nesta versão."
- Persistência local (`localStorage`) é usada apenas para preferências não sensíveis: último item de
  navegação, rascunhos de formulário e uma lista curta de crawls recentes (id + URL, para navegação
  rápida). Nunca para headers, cookies, API key ou segredo de webhook.
