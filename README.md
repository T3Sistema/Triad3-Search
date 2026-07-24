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

## Neo — orquestrador conversacional

Além dos módulos manuais (Capturar, Extrair, Pesquisar, Mapear, Monitorar), o painel tem uma segunda
forma de uso: o **Neo**, em `/neo`. O usuário descreve o que quer investigar em linguagem natural, e o
Neo planeja, escolhe e executa as ferramentas necessárias, cruza os resultados e monta um relatório
estruturado — sem o usuário precisar saber que módulo usar.

O Neo **não substitui** os módulos manuais nem duplica a lógica deles: página manual, API manual e Neo
chamam a mesma camada de serviço server-only (`src/server/services/*.ts`). O Neo nunca chama as rotas
HTTP internas (`/api/triad3/capturar` etc.) — ele importa e chama as funções de serviço diretamente.

> Nota interna (não é frontend): o Neo usa a **Responses API** da OpenAI, modelo fixo `gpt-5.4-mini`
> (`src/server/neo/model.ts`). Esses termos só podem aparecer em código server-only, testes e nesta
> documentação — nunca na interface. Ver `.claude/rules/frontend-product-rules.md` seção 7.

### Modelo — regra absoluta

```ts
export const NEO_MODEL = "gpt-5.4-mini" as const; // src/server/neo/model.ts
```

Único identificador de modelo do projeto. Nunca lido de env var, payload do usuário, query string ou
configuração de runtime. Todas as etapas inteligentes (planejamento, decisão de ferramentas, resumo de
conversa, título automático, síntese final) usam exclusivamente esse modelo — nunca um modelo diferente
para uma etapa específica, nunca um fallback silencioso se a chamada falhar (nesse caso, um erro tratado
é exibido; ver "Tratamento de erros" abaixo).

### Arquitetura (server-only)

```
src/server/neo/
  model.ts            # NEO_MODEL — única fonte do nome do modelo
  config.ts            # leitura de OPENAI_API_KEY (server-only)
  client.ts             # cliente OpenAI + callNeoResponses() (ponto único de chamada ao provedor)
  errors.ts              # erros neutros pt-BR + sanitização (nunca vaza nome de fornecedor/modelo)
  http.ts                  # jsonNeoError() — envelope de erro HTTP para as rotas
  limits.ts                 # NEO_LIMITS — todos os limites de execução, centralizados
  prompt.ts                  # NEO_SYSTEM_PROMPT — prompt permanente, versionado e testável
  schemas.ts                   # NeoPlan, verificação, resumo/título (Zod, server-only)
  tool-names.ts                  # catálogo de nomes de ferramentas + lista das persistentes
  tool-registry.ts                 # registro de ferramentas (schema strict + execute())
  tool-normalizers.ts               # comprime respostas brutas em resumos compactos para o modelo
  confirmations.ts                   # descrição pt-BR de uma ação persistente pendente
  planner.ts                          # Fase 1 — compreensão e plano (Structured Output)
  executor.ts                          # Fase 2 — tool loop (paralelismo, dedup, retry, timeout, limites)
  synthesizer.ts                        # Fase 4 — síntese final (Structured Output: NeoAnswer)
  memory.ts                              # resumo de conversa + título automático (mesmo modelo)
  orchestrator.ts                         # une as 4 fases, persiste no banco, emite eventos SSE
  execution-registry.ts                    # AbortController por execução (suporte a cancelamento)
  events.ts                                 # NeoEventEmitter — grava eventos no stream SSE
  export/                                    # PDF (@react-pdf/renderer), Markdown, CSV, contexto (ownership)
  tools/                                      # uma ferramenta (ou grupo) por arquivo — ver catálogo abaixo

src/lib/neo/                    # bundle-safe (sem segredo/fornecedor) — compartilhado client+server
  answer.ts                      # schema NeoAnswer (Zod) + tipos de bloco do relatório
  events.ts                       # schema dos eventos SSE (discriminated union)
  schemas.ts                       # Zod dos payloads das rotas (conversas, executar, confirmar)
  limits.ts                         # único limite que o cliente também precisa (tamanho máx. de mensagem)

src/components/neo/             # frontend — nunca contém lógica de orquestração
src/hooks/use-neo-*.ts          # TanStack Query (CRUD de conversas) + hook de streaming SSE
```

### Fases da orquestração

1. **Planejamento** (`planner.ts`): recebe mensagem atual + resumo da conversa + mensagens recentes,
   devolve um `NeoPlan` estruturado (objetivo interpretado, se há ambiguidade bloqueante, etapas
   planejadas, ferramentas prováveis, critérios de conclusão). `reasoning.effort: "high"`. Se houver
   ambiguidade bloqueante, o Neo pula direto para a síntese e pergunta ao usuário — nunca para perguntar
   qual ferramenta usar, só quando o alvo realmente não pode ser identificado com segurança.
2. **Execução** (`executor.ts`): loop de decisão de ferramentas. A cada rodada, o modelo recebe o
   catálogo de ferramentas (`tools` da Responses API) e os resultados já coletados; decide chamar mais
   ferramentas ou parar. Chamadas independentes da mesma rodada rodam em paralelo (até
   `NEO_LIMITS.maxParallelTools`); chamadas dependentes acontecem em rodadas seguintes, naturalmente,
   porque o modelo só pede o que já tem contexto para pedir. Deduplicação por assinatura
   (`ferramenta + argumentos`), retry limitado só para falhas transitórias (timeout/rate limit/erro de
   servidor — nunca para erro de validação ou autorização), timeout por ferramenta.
3. **Verificação**: cruzamento de fontes e distinção fato/inferência/ausência acontece via as
   instruções do prompt permanente (seção "Qualidade") combinadas com o schema do relatório, que obriga
   o modelo a declarar `informacoesAusentes` e o nível de evidência de cada fato — não é uma chamada de
   modelo separada, para não adicionar custo/latência sem necessidade real.
4. **Síntese** (`synthesizer.ts`): chamada final ao mesmo `NEO_MODEL`, sem ferramentas habilitadas,
   Structured Output estrito no schema `NeoAnswer` (`reasoning.effort: "medium"`). As fontes disponíveis
   para citação são geradas pelo servidor (`assignFonteIds`) a partir do que as ferramentas realmente
   retornaram — o modelo nunca pode inventar uma fonte ou id que não exista. Se a resposta estruturada
   falhar a validação Zod, uma única tentativa de correção é feita; se falhar de novo, um relatório de
   fallback seguro (texto simples, sem JSON) é apresentado.

Tudo isso é orquestrado por `orchestrator.ts`, que também persiste conversas/mensagens/execuções/etapas/
fontes no banco e emite eventos amigáveis pelo stream SSE (ver "Streaming" abaixo).

### Catálogo de ferramentas (18 no total)

Registradas em `src/server/neo/tool-registry.ts` a partir de `src/server/neo/tools/*.ts`. Todas com
schema Zod **estrito** (`additionalProperties: false`, todo campo obrigatório, opcionais como
`.nullable()`), revalidadas no servidor antes de executar — o modelo nunca decide argumentos sem
validação.

| Ferramenta | Arquivo | Efeito | Confirmação |
|---|---|---|---|
| `pesquisar_web` | `tools/pesquisar.ts` | leitura | não |
| `capturar_pagina` | `tools/capturar.ts` | leitura | não |
| `extrair_dados` | `tools/extrair.ts` | leitura | não |
| `mapear_iniciar`, `mapear_status`, `mapear_paginas`, `mapear_interromper`, `mapear_retomar` | `tools/mapear.ts` | leitura | não |
| `monitor_criar`, `monitor_atualizar`, `monitor_pausar`, `monitor_retomar`, `monitor_excluir` | `tools/monitorar.ts` | **persistente** | **sim** |
| `monitor_listar`, `monitor_status`, `monitor_atividades` | `tools/monitorar.ts` | leitura | não |
| `consultar_historico`, `consultar_creditos` | `tools/auxiliares.ts` | leitura | não |

Cada ferramenta devolve um resultado normalizado e compacto (`src/server/neo/tool-normalizers.ts`) —
nunca a resposta bruta inteira da integração — preservando URLs, títulos, datas, métricas, paginação e
erros. Isso mantém o contexto do modelo pequeno mesmo quando a resposta original é grande.

**Para adicionar uma ferramenta nova:** crie o arquivo em `tools/`, defina o schema Zod (siga o padrão
"todo campo obrigatório, opcional como `.nullable()`"), registre com `registerNeoTool(...)`, importe o
arquivo em `tools/index.ts`, adicione o nome em `NEO_TOOL_NAMES` (`tool-names.ts`) e, se tiver efeito
persistente, em `NEO_PERSISTENT_TOOLS` também. Adicione testes seguindo o padrão de
`tools/*.test.ts` (mock do serviço correspondente).

### Ações persistentes e confirmação

Ferramentas em `NEO_PERSISTENT_TOOLS` (criar/editar/pausar/retomar/excluir monitoramento) nunca
executam a partir de uma function call direta. O executor pausa a execução
(`neo_execucoes.status = 'aguardando_confirmacao'`), salva a ferramenta e os argumentos já validados em
`contexto_pendente` (server-only) e emite o evento `confirmacao.necessaria`. A rota
`POST /api/triad3/neo/execucoes/[id]/confirmar` só aceita `{ confirmar: boolean }` — os argumentos
executados são sempre os que já estavam salvos no servidor, nunca uma versão que o cliente possa enviar
de novo alterada.

### Memória da conversa

Como o Neo usa `store: false` (nunca depende de histórico do lado do provedor, nunca usa
`previous_response_id`), o contexto é reconstruído a cada execução a partir do banco:
`NEO_LIMITS.recentMessagesWindow` mensagens recentes são enviadas literalmente; quando a conversa
cresce além de `NEO_LIMITS.summaryRefreshThreshold` mensagens, um resumo (`neo_conversas.resumo_contexto`)
é atualizado em segundo plano pelo mesmo `NEO_MODEL` (`src/server/neo/memory.ts`).

### Limites de execução

Todos centralizados em `src/server/neo/limits.ts` (`NEO_LIMITS`): máximo de rodadas de decisão, máximo
de chamadas de ferramenta, paralelismo máximo, timeout por ferramenta, execuções simultâneas por
usuário, uma execução ativa por conversa (também reforçado por índice único no banco), tamanho máximo de
mensagem, tamanho máximo de conteúdo normalizado entregue ao modelo, retries para falha transitória.
Ao atingir um limite, a execução não é descartada: um relatório parcial é gerado com o que já foi
encontrado, e o usuário pode continuar em uma nova mensagem.

### Streaming (SSE)

`POST /api/triad3/neo/conversas/[id]/executar` e `POST /api/triad3/neo/execucoes/[id]/confirmar`
respondem com `text/event-stream`, um evento JSON por linha `data: ...`
(`src/lib/neo/events.ts` define o schema discriminado; `src/server/neo/events.ts` grava no stream).
Eventos: `execucao.iniciada`, `plano.pronto`, `etapa.iniciada`, `etapa.concluida`, `etapa.falhou`,
`confirmacao.necessaria`, `resposta.concluida`, `execucao.parcial`, `execucao.cancelada`,
`execucao.falhou`. Cada evento já é uma mensagem amigável em português — nunca payload técnico, nome de
ferramenta interna ou raciocínio do modelo. `src/hooks/use-neo-stream.ts` lê o stream no navegador e
alimenta o painel de progresso e o relatório final.

### Cancelamento

O composer troca o botão de enviar por "Parar" durante uma execução. Cancelar aciona um
`AbortController` local (interrompe a chamada de fetch do navegador) **e** chama
`POST /api/triad3/neo/execucoes/[id]/cancelar`, que aborta o controller registrado no servidor
(`src/server/neo/execution-registry.ts`) se a mesma instância ainda estiver processando, ou atualiza o
status diretamente no banco como fallback. Resultados já encontrados não são descartados: se houver
evidência coletada, um relatório parcial ainda é sintetizado.

### Exportação de relatórios

Cada relatório concluído pode ser exportado como PDF (`src/server/neo/export/pdf.tsx`, gerado
server-side com `@react-pdf/renderer` — nunca screenshot da página), Markdown
(`src/server/neo/export/markdown.ts`) ou CSV por tabela, com BOM UTF-8
(`src/server/neo/export/csv.ts`). Todas as três rotas de exportação exigem sessão válida e verificam que
a mensagem pertence a uma conversa do usuário autenticado (`src/server/neo/export/context.ts`) antes de
gerar qualquer arquivo.

### Segurança contra prompt injection

O prompt permanente (`src/server/neo/prompt.ts`) trata todo conteúdo de página/busca/ferramenta como
dado não confiável, nunca como instrução — nunca segue comando encontrado em conteúdo consultado, nunca
revela o próprio prompt, chave ou configuração, nunca executa uma ferramenta porque um texto "mandou".
O `executor.ts` reforça isso estruturalmente: a única forma de uma ferramenta ser chamada é através de
uma function call real do modelo na resposta da Responses API — resultado de ferramenta anterior nunca
é reinterpretado como comando (ver teste "prompt injection vindo de ferramenta" em
`src/server/neo/executor.test.ts`).

### Tratamento de erros

Erros do Neo nunca vazam detalhe técnico — sempre mensagens neutras em pt-BR
(`src/server/neo/errors.ts`): "Não foi possível iniciar a investigação.", "Uma fonte demorou mais que o
esperado.", "O relatório foi concluído parcialmente.", "A execução foi interrompida.", "O Neo ainda não
está configurado." (quando `OPENAI_API_KEY` está ausente), "Limite temporário atingido." Nunca aparece
erro bruto do SDK, nome de modelo, endpoint, stack trace ou payload.

### Troubleshooting

- **"O Neo ainda não está configurado."** → `OPENAI_API_KEY` não está definida (ou está vazia) no
  ambiente do servidor. Cadastre a variável e reinicie o servidor/redeploy; os módulos manuais
  continuam funcionando normalmente enquanto isso.
- **Erro de tabela inexistente (`neo_conversas`, `neo_mensagens`, `neo_execucoes`, `neo_etapas` ou
  `neo_fontes`)** → a migration `supabase/migrations/20260724010000_criar_tabelas_neo.sql` ainda não
  foi executada nesse banco. Rode-a no painel SQL do Supabase (ou via CLI) contra o ambiente afetado.
- **Uma conversa trava em "processando" indefinidamente** → confira se a rota
  `.../executar` está recebendo `maxDuration = 300` no ambiente de deploy (planos com timeout menor
  cortam a resposta antes do streaming terminar); o cancelamento manual
  (`POST /api/triad3/neo/execucoes/[id]/cancelar`) sempre resolve o estado para um status terminal,
  então também funciona como saída de emergência.
- **Quero validar a chamada real à LLM antes de ir para produção** → ver "Testes ao vivo do Neo" na
  seção Scripts: defina `RUN_NEO_LIVE_TESTS=true` e `OPENAI_API_KEY` localmente e rode `npm run test`;
  sem essas variáveis, nenhum teste tenta uma chamada real.
- **Uma ferramenta nova não aparece nas decisões do Neo** → confirme que ela foi registrada em
  `NEO_TOOL_NAMES` (`src/server/neo/tool-names.ts`) e importada em `tools/index.ts` — só ferramentas
  no catálogo (`tool-registry.ts`) são oferecidas ao modelo; rode `tool-registry.test.ts` para validar
  que o schema estrito (`additionalProperties:false`, todo campo obrigatório) está correto.

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
- `openai` (SDK oficial, Responses API — server-only, ver seção Neo) e `@react-pdf/renderer`
  (exportação de PDF server-side, sem screenshot)
- Vitest + Testing Library para testes

## Como rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha SGAI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY e OPENAI_API_KEY
# rode as migrations em supabase/migrations/ no seu projeto Supabase (ver seções Autenticação e Neo)
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
OPENAI_API_KEY=
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
- `OPENAI_API_KEY`: obrigatória para o Neo. Lida apenas em `src/server/neo/config.ts`/`client.ts`, no
  servidor. Se estiver ausente, o Neo responde com "O Neo ainda não está configurado." em vez de
  quebrar — os módulos manuais continuam funcionando normalmente mesmo sem essa variável.

Nunca use o prefixo `NEXT_PUBLIC_` para a chave da integração, para a chave secreta do banco ou para a
chave do Neo — isso as exporia no navegador.

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

### Testes ao vivo do Neo (opcionais, consomem créditos reais de LLM)

Toda a suíte padrão do Neo (planejador, executor, sintetizador, orquestrador, ferramentas, rotas,
componentes) usa **mocks determinísticos** — nenhuma chamada real à LLM acontece em `npm run test` nem
no CI. Para validar manualmente com a API real:

```env
RUN_NEO_LIVE_TESTS=true
OPENAI_API_KEY=sua-chave-real
```

Com essas variáveis definidas, use ferramentas fake (nunca crie um monitoramento real nem use dados
pessoais), valide seleção de ferramentas e schema, e limite manualmente o número de chamadas/tokens.
Sem essas variáveis, nenhuma chamada real ao provedor de LLM é feita — e nenhum teste tenta.

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
   OPENAI_API_KEY=chave_real_do_neo
   ```
4. Marque as chaves para os ambientes necessários (Production / Preview / Development).
5. Rode as migrations em `supabase/migrations/` contra o banco de cada ambiente — incluindo
   `20260724010000_criar_tabelas_neo.sql` (o painel SQL do Supabase ou a CLI do Supabase servem para
   isso) — este projeto não roda migrations automaticamente.
6. Crie o primeiro usuário rodando `npm run usuario:criar` localmente, apontando `SUPABASE_URL`/
   `SUPABASE_SECRET_KEY` para o banco do ambiente de destino.
7. Faça um novo deploy.
8. Nunca commite as chaves reais no Git nem as exponha como `NEXT_PUBLIC_*`.

O modelo do Neo (`gpt-5.4-mini`) **não** é uma variável de ambiente — é fixo em
`src/server/neo/model.ts` e não precisa (nem deve) ser cadastrado na Vercel.

As rotas que consultam a integração usam `export const runtime = "nodejs"`,
`export const dynamic = "force-dynamic"`, `cache: "no-store"` nas chamadas de saída e
`Cache-Control: no-store` nas respostas. Rotas que podem demorar mais (Capturar, Extrair, Pesquisar,
Mapear) declaram `export const maxDuration = 60`; as rotas de execução do Neo
(`.../executar`, `.../confirmar`) declaram `export const maxDuration = 300` para acomodar
investigações com várias etapas — ajuste esses valores conforme o plano da Vercel, se necessário
(streaming ajuda a não bater no limite de execução síncrona em planos com timeout mais curto).

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
      neo/page.tsx                     # Neo — lista de conversas + nova conversa
      neo/[id]/page.tsx                 # Neo — conversa (chat, streaming, confirmação, export)
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
      neo/                           # rotas do orquestrador conversacional (ver seção "Neo" acima)
        conversas/route.ts, conversas/[id]/route.ts, conversas/[id]/mensagens/route.ts,
        conversas/[id]/executar/route.ts                      # POST — streaming SSE
        execucoes/[id]/route.ts, execucoes/[id]/cancelar/route.ts, execucoes/[id]/confirmar/route.ts
        mensagens/[id]/exportar/pdf/route.ts, mensagens/[id]/exportar/markdown/route.ts
        mensagens/[id]/tabelas/[indice]/csv/route.ts
  components/
    layout/                        # Sidebar, Topbar, AppShell, LogoutButton, créditos, status de conexão
    playground/                    # FormatSelector, FetchConfigAccordion, SchemaEditor, RequestPreview
    viewer/                        # JsonTree, JsonCode, Markdown, HtmlSource, Links, Imagens,
                                    # Screenshot, SearchResults, Metadata, Error, Loading, Empty
    pages/                          # componentes de página (Capturar/Extrair/Pesquisar/Mapear/Monitorar/Histórico/Login)
    neo/                            # UI do Neo — chat, blocos de relatório, confirmação, export
      neo-page.tsx, conversation-sidebar.tsx, composer.tsx, mensagem.tsx
      answer-view.tsx, answer-blocks.tsx                        # renderizadores allowlisted (nunca JSON cru)
      confirmation-card.tsx, execution-progress.tsx, export-menu.tsx
      safe-link.tsx, safe-image.tsx, neo-empty-state.tsx        # sanitização de link/imagem nos blocos
    ui/                             # primitivos estilo shadcn (Radix + Tailwind)
  hooks/                           # hooks TanStack Query por serviço
    use-neo-conversas.ts            # CRUD de conversas/mensagens
    use-neo-stream.ts               # consumo do SSE de execução (fetch + ReadableStream, com cancelamento)
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
    neo/                            # orquestrador do Neo — server-only, nunca importado pelo cliente
      model.ts                      # const NEO_MODEL = "gpt-5.4-mini" — única fonte de verdade
      client.ts                     # callNeoResponses() — único ponto de chamada à Responses API
      config.ts                     # leitura de OPENAI_API_KEY (server-only)
      limits.ts                     # NEO_LIMITS — rounds, tool calls, paralelismo, retries, timeouts
      planner.ts                    # fase 1 — interpreta o pedido, Structured Output do plano
      executor.ts                   # fase 2 — loop de ferramentas (paralelo, dedup, retry, timeout, pausa p/ confirmação)
      synthesizer.ts                # fase 4 — Structured Output da resposta final (NeoAnswer)
      memory.ts                     # título da conversa + resumo incremental de contexto
      orchestrator.ts               # amarra as 4 fases, streaming de eventos, cancelamento, retomada pós-confirmação
      confirmations.ts              # persistência/leitura do contexto pendente de ações persistentes
      execution-registry.ts         # limite de execuções concorrentes por usuário
      tool-registry.ts              # catálogo das 18 ferramentas (schema Zod estrito + handler)
      tool-names.ts, tool-normalizers.ts
      schemas.ts                    # Zod dos payloads internos (plano, eventos, etc.)
      prompt.ts                     # instruções de sistema por fase
      errors.ts, events.ts, http.ts
  lib/
    auth/                          # compartilhado client+server, sem segredos
      validation.ts                  # normalizeEmail, isValidEmail, isStrongPassword
      redirect-target.ts             # sanitizeInternalPath — bloqueia redirecionamento aberto
      schemas.ts                     # Zod do payload de login
    integration/                    # Zod + tipos compartilhados entre client e server (sem segredos)
      formats.ts                    # formatos compartilhados (Capturar/Mapear/Monitorar) + FetchConfig
      schemas.ts                    # Zod para cada payload de requisição
      render-helpers.ts
    neo/                            # compartilhado client+server, sem segredos
      answer.ts                     # schema Zod do NeoAnswer + 10 blocos de relatório + fallback seguro
      events.ts                     # schema Zod dos eventos SSE (união discriminada)
      schemas.ts                    # tipos/Zod compartilhados (conversa, mensagem)
      limits.ts                     # NEO_MESSAGE_MAX_LENGTH e afins (compartilhado com o servidor)
    ui/                             # camada de apresentação — nunca mostra enum/status cru
      status-labels.ts               # tradução de status/serviços para pt-BR
      formatting.ts                  # Intl.DateTimeFormat/NumberFormat("pt-BR")
    api-utils.ts                    # helpers de resposta, checagem de Origin, limite de payload, requireApiUser()
scripts/
  ui-policy.config.mjs              # lista de termos proibidos no frontend (extensível, inclui termos do Neo)
  check-ui-policy.mjs               # verificador (código-fonte e bundle estático)
  create-user.ts                    # CLI de "npm run usuario:criar" — não importa código server-only
supabase/migrations/                # migrations SQL versionadas
  20260724000000_criar_tabelas_autenticacao.sql   # usuarios, sessoes, tentativas_login
  20260724010000_criar_tabelas_neo.sql            # neo_conversas, neo_mensagens, neo_execucoes, neo_etapas, neo_fontes
.claude/rules/frontend-product-rules.md  # regras detalhadas de idioma, paleta, neutralização (inclui seção Neo)
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
