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

- **O painel exige login.** Toda página interna e toda rota privada de `/api/triad3/*` verificam uma
  sessão real no backend antes de responder — veja "Autenticação" abaixo para a arquitetura completa.
  Não há cadastro público; contas são criadas apenas via `npm run usuario:criar`.
- A chave da integração (`SGAI_API_KEY`) **nunca** é enviada ao navegador. Toda comunicação externa
  passa por `src/server/integrations/web-intelligence/client.ts` (marcado com `import "server-only"`)
  e pelas rotas internas neutras em `src/app/api/triad3/*`, que rodam apenas no servidor
  (`export const runtime = "nodejs"`).
- Não existe um proxy genérico: cada rota interna é específica, valida o payload com Zod e só chama
  o endpoint correspondente da integração.
- Headers/cookies customizados (configurações avançadas de captura) nunca são persistidos no
  navegador e nunca aparecem em logs do servidor — apenas `{ id, endpoint, status, durationMs }` é
  registrado por chamada.

## Autenticação

Autenticação própria, sem nenhum serviço de auth pronto (sem Supabase Auth, Auth.js/NextAuth, Clerk
etc.). O banco (Postgres do Supabase) é usado só como banco — usuários, senhas e sessões são
controlados inteiramente pelas tabelas e pelo backend deste projeto.

- **Fluxo:** navegador → rotas internas `/api/triad3/sessao/entrar` e `/api/triad3/sessao/sair` →
  banco. O frontend nunca consulta a tabela de usuários, nunca recebe `password_hash`/hash de token, e
  nunca decide sozinho se alguém está autenticado.
- **Tabelas** (migration versionada em `supabase/migrations/20260724000000_criar_tabelas_autenticacao.sql`):
  `usuarios` (com `password_hash`, `tentativas_falhas`, `bloqueado_ate`), `sessoes` (guarda só o SHA-256
  do token, nunca o token original) e `tentativas_login` (log persistente para o rate limit, já que o
  projeto roda em ambiente serverless — memória local não sobrevive entre invocações). RLS habilitado
  nas três, sem política para `anon`/`authenticated`: só a chave secreta server-only tem acesso.
- **Senhas:** Argon2id via `@node-rs/argon2` (`src/server/auth/password.ts`), salt aleatório embutido no
  hash, nunca implementado manualmente. Login roda uma verificação Argon2id "fictícia" quando o e-mail
  não existe, para igualar o tempo de resposta e não permitir enumeração de contas.
- **Sessão:** token de 32 bytes aleatórios (`crypto.randomBytes`), entregue só via cookie `HttpOnly`
  (`SESSION_COOKIE_NAME`, padrão `triad3_session`) — o banco guarda apenas o SHA-256 do token. Duração
  padrão de 8 horas, ou 30 dias com "Manter conectado". `Secure` em produção, `SameSite=Lax`.
- **Rate limit:** bloqueio de 5 tentativas inválidas em 15 minutos, contado por hash do e-mail (tabela
  `tentativas_login`), aplicado igualmente a e-mails existentes ou não — a resposta nunca revela se uma
  conta existe (`src/server/auth/rate-limit.ts`).
- **Proteção de rotas:** `src/proxy.ts` faz só uma checagem otimista (cookie presente?) para melhorar a
  navegação — **não** é a proteção real. A proteção de verdade acontece em
  `src/app/(app)/layout.tsx` (`exigirUsuario()`, Server Component) para as páginas, e em
  `requireApiUser()` (`src/lib/api-utils.ts`) no topo de toda rota privada de `/api/triad3/*`.
  `retorno=` só aceita caminhos internos (`/algo`), nunca `//`, protocolos ou URLs externas
  (`src/lib/auth/redirect-target.ts`).
- **Criar o primeiro usuário:** não há cadastro público.
  ```bash
  npm run usuario:criar
  ```
  Pede nome, e-mail, senha (mínimo 12 caracteres, oculta ao digitar quando o terminal permite) e
  confirmação; nunca aceita senha por argumento de linha de comando, nunca imprime senha/hash, nunca
  grava credenciais em arquivo. Precisa de `SUPABASE_URL`/`SUPABASE_SECRET_KEY` no ambiente (ex.:
  `.env.local`).

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
cp .env.example .env.local   # preencha SGAI_API_KEY, SUPABASE_URL e SUPABASE_SECRET_KEY
# rode a migration em supabase/migrations/ no seu projeto Supabase (ver seção Autenticação)
npm run usuario:criar         # crie o primeiro usuário
npm run dev
```

Abra `http://localhost:3000` — a raiz (`/`) exige login e leva a `/login` até você entrar; depois de
autenticado, `/` abre o painel (ferramenta Capturar).

## Variáveis de ambiente

```env
SGAI_API_KEY=
SGAI_BASE_URL=https://v2-api.scrapegraphai.com
NEXT_PUBLIC_APP_NAME=Triad3 Search
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SESSION_COOKIE_NAME=triad3_session
```

Os nomes dessas variáveis são mantidos como estão (compatibilidade com deploys existentes na Vercel)
— elas só são lidas no servidor e nunca aparecem na interface.

- `SGAI_API_KEY`: obrigatória. Lida apenas em `src/server/integrations/web-intelligence/client.ts`,
  no servidor. Se estiver ausente, todas as rotas retornam um erro amigável em português (sem
  mencionar o nome da variável ao usuário) em vez de quebrar o painel.
- `SGAI_BASE_URL`: opcional, padrão `https://v2-api.scrapegraphai.com`.
- `NEXT_PUBLIC_APP_NAME`: opcional, usado apenas no `<title>` da página (não contém segredo).
- `SUPABASE_URL`: obrigatória. URL do projeto Supabase usado só como Postgres — lida apenas em
  `src/server/db/client.ts`.
- `SUPABASE_SECRET_KEY`: obrigatória. Chave secreta server-only (ignora RLS por padrão) — nunca a
  publishable/anon key. Lida apenas em `src/server/db/client.ts`.
- `SESSION_COOKIE_NAME`: opcional, padrão `triad3_session`. Nome do cookie de sessão (o nome em si não
  é sensível — o cookie é `HttpOnly`, então JS do navegador não o lê de qualquer forma).

Nunca use o prefixo `NEXT_PUBLIC_` para a chave da integração ou para a chave secreta do banco — isso
as exporia no navegador.

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
npm run usuario:criar             # cria um usuário (interativo — sem cadastro público)
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
   SUPABASE_URL=url_do_projeto_supabase
   SUPABASE_SECRET_KEY=chave_secreta_real
   SESSION_COOKIE_NAME=triad3_session
   ```
4. Marque as chaves para os ambientes necessários (Production / Preview / Development).
5. Rode a migration em `supabase/migrations/` contra o banco de cada ambiente (o painel SQL do
   Supabase ou a CLI do Supabase servem para isso) — este projeto não roda migrations automaticamente.
6. Crie o primeiro usuário rodando `npm run usuario:criar` localmente, apontando `SUPABASE_URL`/
   `SUPABASE_SECRET_KEY` para o banco do ambiente de destino.
7. Faça um novo deploy.
8. Nunca commite as chaves reais no Git nem as exponha como `NEXT_PUBLIC_*`.

As rotas que consultam a integração usam `export const runtime = "nodejs"`,
`export const dynamic = "force-dynamic"`, `cache: "no-store"` nas chamadas de saída e
`Cache-Control: no-store` nas respostas. Rotas que podem demorar mais (Capturar, Extrair, Pesquisar,
Mapear) declaram `export const maxDuration = 60`; ajuste esse valor conforme o plano da Vercel, se
necessário.

## Estrutura principal

```
src/
  proxy.ts                        # checagem otimista de cookie (não é a proteção real)
  app/
    layout.tsx                    # QueryProvider + Toaster — sem chrome (cada grupo de rota decide)
    (public)/
      layout.tsx                   # passthrough, sem sidebar/topbar
      login/page.tsx                # redireciona para "/" se já autenticado; senão renderiza LoginPage
    (app)/
      layout.tsx                   # exigirUsuario() (proteção real) + <AppShell>
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
      sessao/entrar/route.ts, sessao/sair/route.ts   # login/logout — únicas rotas sem requireApiUser()
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
    layout/                        # Sidebar, Topbar, AppShell, LogoutButton, créditos, status de conexão
    playground/                    # FormatSelector, FetchConfigAccordion, SchemaEditor, RequestPreview
    viewer/                        # JsonTree, JsonCode, Markdown, HtmlSource, Links, Imagens,
                                    # Screenshot, SearchResults, Metadata, Error, Loading, Empty
    pages/                          # componentes de página (Capturar/Extrair/Pesquisar/Mapear/Monitorar/Histórico/Login)
    ui/                             # primitivos estilo shadcn (Radix + Tailwind)
  hooks/                           # hooks TanStack Query por serviço
  server/
    db/
      client.ts                     # cliente admin do Supabase (só Postgres), import "server-only"
      repositories/                 # usuarios.ts, sessoes.ts, tentativas-login.ts — uma query por função
    auth/                          # autenticação própria — server-only
      sessions.ts                   # criarSessao, obterSessaoAtual, exigirUsuario, revogarSessao, limparSessoesExpiradas
      password.ts                   # Argon2id (@node-rs/argon2), verificação fictícia para timing parity
      users.ts, rate-limit.ts        # lockout de conta + limite persistente de tentativas
      config.ts, hash-utils.ts, request-ip.ts, argon2-params.ts
    integrations/
      web-intelligence/             # tudo relacionado ao fornecedor externo — server-only
        client.ts                   # cliente central (timeout, retry, logging seguro), import "server-only"
        errors.ts                   # normalização de erros + mensagens neutras em pt-BR
        sanitize.ts                 # remove nome/domínio/header do fornecedor de mensagens externas
        types.ts                    # tipos "passthrough" para as respostas
  lib/
    auth/                          # compartilhado client+server, sem segredos
      validation.ts                  # normalizeEmail, isValidEmail, isStrongPassword
      redirect-target.ts             # sanitizeInternalPath — bloqueia redirecionamento aberto
      schemas.ts                     # Zod do payload de login
    integration/                    # Zod + tipos compartilhados entre client e server (sem segredos)
      formats.ts                    # formatos compartilhados (Capturar/Mapear/Monitorar) + FetchConfig
      schemas.ts                    # Zod para cada payload de requisição
      render-helpers.ts
    ui/                             # camada de apresentação — nunca mostra enum/status cru
      status-labels.ts               # tradução de status/serviços para pt-BR
      formatting.ts                  # Intl.DateTimeFormat/NumberFormat("pt-BR")
    api-utils.ts                    # helpers de resposta, checagem de Origin, limite de payload, requireApiUser()
scripts/
  ui-policy.config.mjs              # lista de termos proibidos no frontend (extensível)
  check-ui-policy.mjs               # verificador (código-fonte e bundle estático)
  create-user.ts                    # CLI de "npm run usuario:criar" — não importa código server-only
supabase/migrations/                # migrations SQL versionadas (usuarios, sessoes, tentativas_login)
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
