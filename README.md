# Triad3 Search

Painel de operação em português do Brasil para capturar, extrair, pesquisar, mapear e monitorar
páginas da web. A interface mostra apenas a marca **Triad3 Search** — nenhum fornecedor, domínio ou
integração externa é identificado no frontend (veja "Política de neutralização" abaixo).

Este é um projeto **funcional**, não uma demonstração: todas as ferramentas fazem chamadas reais à
integração configurada no backend deste projeto.

> Nota para quem mantém este repositório (documentação técnica interna, não é frontend): a
> integração atual é com a **API V2 da ScrapeGraphAI**. Esse nome só pode aparecer em código
> server-only, testes, e nesta documentação — nunca na interface. Veja
> `.claude/rules/frontend-product-rules.md` e `CLAUDE.md` para as regras permanentes de produto.

## Regras de segurança importantes

- **Não há login nem cadastro.** Qualquer pessoa com acesso ao endereço público deste painel pode
  disparar requisições e consumir os créditos configurados no servidor. Se isso for um problema,
  restrinja o acesso à URL por outro meio (VPN, proxy autenticado, IP allowlist etc.) — este projeto
  não implementa autenticação por decisão de escopo.
- A chave da integração (`SGAI_API_KEY`) **nunca** é enviada ao navegador. Toda comunicação externa
  passa por `src/server/integrations/web-intelligence/client.ts` (marcado com `import "server-only"`)
  e pelas rotas internas neutras em `src/app/api/triad3/*`, que rodam apenas no servidor
  (`export const runtime = "nodejs"`).
- Não existe um proxy genérico: cada rota interna é específica, valida o payload com Zod e só chama
  o endpoint correspondente da integração.
- Headers/cookies customizados (configurações avançadas de captura) nunca são persistidos no
  navegador e nunca aparecem em logs do servidor — apenas `{ id, endpoint, status, durationMs }` é
  registrado por chamada.

## Política de neutralização e idioma (regras permanentes)

Estas regras são permanentes e estão registradas em `CLAUDE.md` e
`.claude/rules/frontend-product-rules.md`:

1. Todo texto visível ao usuário está em português do Brasil (o nome `Triad3 Search` nunca é
   traduzido).
2. O fundo global é `#DBE2E9`; a interface é exclusivamente clara, sem tema escuro.
3. Nenhum fornecedor, domínio externo, header de autenticação ou nome comercial de integração aparece
   no frontend — só a marca Triad3 Search. **Exceção:** conteúdo legítimo que o próprio usuário
   pesquisou/capturou nunca é censurado, mesmo que mencione empresas ou fornecedores.
4. A integração externa é isolada em `src/server/integrations/web-intelligence/` (server-only).
5. Erros de infraestrutura passam por `sanitizeIntegrationError` antes de chegar ao navegador.

Essas regras são protegidas por um verificador automático (não apenas orientação):

```bash
npm run check:ui-policy          # varre o código-fonte do frontend
npm run check:ui-policy:static   # varre o bundle .next/static já buildado
```

A lista de termos proibidos vive em `scripts/ui-policy.config.mjs`
(`forbiddenFrontendTerms`) — **toda nova integração deve adicionar seus próprios identificadores
ali no mesmo PR que a introduz**. `npm run build` já roda as duas verificações automaticamente (antes
e depois do `next build`), e o workflow `.github/workflows/quality.yml` roda tudo em cada Pull
Request.

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

Abra `http://localhost:3000` — a rota `/` já abre o painel (ferramenta Capturar).

## Variáveis de ambiente

```env
SGAI_API_KEY=
SGAI_BASE_URL=https://v2-api.scrapegraphai.com
NEXT_PUBLIC_APP_NAME=Triad3 Search
```

Os nomes dessas variáveis são mantidos como estão (compatibilidade com deploys existentes na Vercel)
— elas só são lidas no servidor e nunca aparecem na interface.

- `SGAI_API_KEY`: obrigatória. Lida apenas em `src/server/integrations/web-intelligence/client.ts`,
  no servidor. Se estiver ausente, todas as rotas retornam um erro amigável em português (sem
  mencionar o nome da variável ao usuário) em vez de quebrar o painel.
- `SGAI_BASE_URL`: opcional, padrão `https://v2-api.scrapegraphai.com`.
- `NEXT_PUBLIC_APP_NAME`: opcional, usado apenas no `<title>` da página (não contém segredo).

Nunca use o prefixo `NEXT_PUBLIC_` para a chave da integração — isso a exporia no navegador.

## Scripts

```bash
npm run dev                    # desenvolvimento
npm run build                   # política (código-fonte) + build de produção + política (bundle)
npm run start                    # servidor de produção (após build)
npm run lint                     # ESLint (inclui regras do React Compiler)
npm run typecheck                # tsc --noEmit
npm run test                      # testes unitários (Vitest), sem consumir créditos reais
npm run check:ui-policy           # política de neutralização/idioma no código-fonte
npm run check:ui-policy:static    # política de neutralização/idioma no bundle .next/static
```

### Testes ao vivo (opcionais, consomem créditos reais)

Por padrão nenhum teste chama a integração real. Para validar manualmente, defina:

```env
RUN_LIVE_TESTS=true
SGAI_API_KEY=sua-chave-real
```

Com essas variáveis definidas, use primeiro a consulta de créditos para confirmar a conexão e, no
máximo, uma operação barata de captura contra `https://example.com` antes de qualquer teste mais
amplo. Sem essas variáveis, nenhuma chamada real é feita.

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

As rotas que consultam a integração usam `export const runtime = "nodejs"`,
`export const dynamic = "force-dynamic"`, `cache: "no-store"` nas chamadas de saída e
`Cache-Control: no-store` nas respostas. Rotas que podem demorar mais (Capturar, Extrair, Pesquisar,
Mapear) declaram `export const maxDuration = 60`; ajuste esse valor conforme o plano da Vercel, se
necessário.

## Estrutura principal

```
src/
  app/
    page.tsx                     # "/" — Capturar (painel abre direto aqui)
    extract/page.tsx              # Extrair
    search/page.tsx               # Pesquisar
    crawl/page.tsx                 # Mapear site — criar
    crawl/[id]/page.tsx             # Mapear site — acompanhar/gerenciar
    monitor/page.tsx                # Monitorar — criar + "meus monitores"
    monitor/[id]/page.tsx           # Monitorar — detalhe + atividade
    history/page.tsx
    history/[id]/page.tsx
    docs/page.tsx                   # "Ajuda" no menu — documentação interna do painel
    api/triad3/                     # rotas internas neutras (nomes em português, sem menção a fornecedor)
      capturar/route.ts
      extrair/route.ts
      pesquisar/route.ts
      mapear/route.ts, mapear/[id]/route.ts, mapear/[id]/paginas/route.ts,
      mapear/[id]/interromper/route.ts, mapear/[id]/retomar/route.ts
      monitoramentos/route.ts, monitoramentos/[id]/route.ts, monitoramentos/[id]/pausar/route.ts,
      monitoramentos/[id]/retomar/route.ts, monitoramentos/[id]/atividades/route.ts
      historico/route.ts, historico/[id]/route.ts
      creditos/route.ts
      schema/route.ts               # gerador de schema com IA (opcional/best-effort)
  components/
    layout/                        # Sidebar, Topbar, AppShell, créditos, status de conexão
    playground/                    # FormatSelector, FetchConfigAccordion, SchemaEditor, RequestPreview
    viewer/                        # JsonTree, JsonCode, Markdown, HtmlSource, Links, Imagens,
                                    # Screenshot, SearchResults, Metadata, Error, Loading, Empty
    pages/                          # componentes de página (Capturar/Extrair/Pesquisar/Mapear/Monitorar/Histórico)
    ui/                             # primitivos estilo shadcn (Radix + Tailwind)
  hooks/                           # hooks TanStack Query por serviço
  server/
    integrations/
      web-intelligence/             # tudo relacionado ao fornecedor externo — server-only
        client.ts                   # cliente central (timeout, retry, logging seguro), import "server-only"
        errors.ts                   # normalização de erros + mensagens neutras em pt-BR
        sanitize.ts                 # remove nome/domínio/header do fornecedor de mensagens externas
        types.ts                    # tipos "passthrough" para as respostas
  lib/
    integration/                    # Zod + tipos compartilhados entre client e server (sem segredos)
      formats.ts                    # formatos compartilhados (Capturar/Mapear/Monitorar) + FetchConfig
      schemas.ts                    # Zod para cada payload de requisição
      render-helpers.ts
    ui/                             # camada de apresentação — nunca mostra enum/status cru
      status-labels.ts               # tradução de status/serviços para pt-BR
      formatting.ts                  # Intl.DateTimeFormat/NumberFormat("pt-BR")
    api-utils.ts                    # helpers de resposta, checagem de Origin, limite de payload
scripts/
  ui-policy.config.mjs              # lista de termos proibidos no frontend (extensível)
  check-ui-policy.mjs               # verificador (código-fonte e bundle estático)
.claude/rules/frontend-product-rules.md  # regras detalhadas de idioma, paleta, neutralização
```

## Sobre a documentação oficial da integração

Os payloads e endpoints implementados seguem a especificação fornecida para este projeto (Base URL
`https://v2-api.scrapegraphai.com`, prefixo `/api`, header `SGAI-APIKEY`). No momento da implementação,
`docs.scrapegraphai.com` bloqueou o acesso automatizado direto (HTTP 403) às páginas de referência
específicas de cada endpoint; a estrutura de payload usada aqui foi confirmada via busca (que validou
Base URL, prefixo e o formato do array `formats[]`) e via a especificação repassada para este projeto,
que reflete a documentação oficial. Todas as respostas são tratadas como **passthrough** (`.passthrough()`
no Zod / tipos com índice de assinatura aberta) — nenhum campo desconhecido é descartado, e a aba
"JSON" sempre mostra o payload original completo. Caso a integração altere nomes de propriedades em
uma versão futura, ajuste os schemas em `src/lib/integration/schemas.ts` e os tipos em
`src/server/integrations/web-intelligence/types.ts` — a UI não quebra com campos novos ou ausentes
graças ao passthrough.

## Limitações conhecidas

- O endpoint opcional de geração automática de schema é chamado de forma best-effort: se a integração
  não o expuser, o editor de schema manual continua funcionando normalmente e a UI mostra "Gerador
  automático de schema indisponível nesta versão."
- Persistência local (`localStorage`) é usada apenas para preferências não sensíveis: último item de
  navegação, rascunhos de formulário e uma lista curta de mapeamentos recentes (id + URL, para
  navegação rápida). Nunca para headers, cookies, chaves de API ou segredo de webhook.
