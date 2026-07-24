-- Tabelas do Neo (orquestrador conversacional do Triad3 Search).
--
-- Memória própria de conversas/execuções do Neo. Segue exatamente o mesmo
-- padrão de segurança da migration de autenticação
-- (20260724000000_criar_tabelas_autenticacao.sql): RLS habilitado sem
-- nenhuma policy para "anon"/"authenticated", e revoke explícito dos
-- privilégios padrão. O único acesso real acontece pelo backend, autenticado
-- com a chave secreta server-only (SUPABASE_SECRET_KEY), sempre filtrando
-- por usuario_id (ver src/server/neo/repositories/).
--
-- Nenhuma destas tabelas guarda segredo, chave, prompt de sistema ou
-- resposta bruta do fornecedor de LLM — apenas o conteúdo já sanitizado
-- exibido ao próprio usuário dono da conversa.

-- neo_conversas ---------------------------------------------------------

create table if not exists neo_conversas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null check (btrim(titulo) <> ''),
  resumo_contexto text,
  status text not null default 'ativa' check (status in ('ativa', 'arquivada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz
);

create index if not exists neo_conversas_usuario_id_idx on neo_conversas (usuario_id);
create index if not exists neo_conversas_usuario_atualizado_idx
  on neo_conversas (usuario_id, atualizado_em desc)
  where excluido_em is null;

-- Reusa a função de trigger já criada pela migration de autenticação.
drop trigger if exists neo_conversas_set_atualizado_em on neo_conversas;
create trigger neo_conversas_set_atualizado_em
  before update on neo_conversas
  for each row
  execute function triad3_set_atualizado_em();

-- neo_mensagens -----------------------------------------------------------

create table if not exists neo_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references neo_conversas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  papel text not null check (papel in ('usuario', 'assistente', 'sistema')),
  conteudo text,
  resposta_estruturada jsonb,
  status text not null default 'concluida'
    check (status in ('pendente', 'em_execucao', 'concluida', 'parcial', 'falhou', 'cancelada')),
  criado_em timestamptz not null default now()
);

create index if not exists neo_mensagens_conversa_id_idx on neo_mensagens (conversa_id, criado_em);
create index if not exists neo_mensagens_usuario_id_idx on neo_mensagens (usuario_id);

-- neo_execucoes -------------------------------------------------------------

create table if not exists neo_execucoes (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references neo_conversas(id) on delete cascade,
  mensagem_usuario_id uuid not null references neo_mensagens(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  status text not null check (
    status in (
      'planejando', 'executando', 'verificando', 'sintetizando',
      'aguardando_confirmacao', 'concluida', 'parcial', 'falhou', 'cancelada'
    )
  ),
  plano jsonb,
  campos_solicitados jsonb,
  campos_encontrados jsonb,
  campos_ausentes jsonb,
  erro_publico text,
  idempotency_key text,
  -- Estado interno serializado do loop de ferramentas, usado apenas para
  -- retomar uma execução pausada aguardando confirmação de ação persistente
  -- (ver src/server/neo/executor.ts). Nunca é exposto pela API — as rotas só
  -- retornam nome público da ferramenta + argumentos já sanitizados.
  contexto_pendente jsonb,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  cancelado_em timestamptz,
  total_ferramentas integer not null default 0,
  tokens_entrada bigint,
  tokens_saida bigint
);

create index if not exists neo_execucoes_conversa_id_idx on neo_execucoes (conversa_id);
create index if not exists neo_execucoes_usuario_id_idx on neo_execucoes (usuario_id);

-- "Somente uma execução ativa por conversa" (regra de negócio) reforçada no
-- próprio banco: só pode existir uma linha em estado não-terminal por conversa.
create unique index if not exists neo_execucoes_conversa_ativa_idx
  on neo_execucoes (conversa_id)
  where status in ('planejando', 'executando', 'verificando', 'sintetizando', 'aguardando_confirmacao');

-- Idempotência de envio: o mesmo idempotency_key nunca cria duas execuções
-- na mesma conversa (protege contra duplo clique / reenvio de rede).
create unique index if not exists neo_execucoes_idempotency_key_idx
  on neo_execucoes (conversa_id, idempotency_key)
  where idempotency_key is not null;

-- neo_etapas ----------------------------------------------------------------

create table if not exists neo_etapas (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references neo_execucoes(id) on delete cascade,
  ordem integer not null,
  tipo text not null check (tipo in ('ferramenta', 'confirmacao', 'verificacao', 'sintese')),
  nome_publico text not null,
  ferramenta_interna text,
  status text not null
    check (status in ('aguardando', 'em_execucao', 'concluida', 'parcial', 'falhou', 'cancelada')),
  argumentos_sanitizados jsonb,
  resultado_resumido jsonb,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  erro_publico text
);

create index if not exists neo_etapas_execucao_id_idx on neo_etapas (execucao_id, ordem);

-- neo_fontes ------------------------------------------------------------

create table if not exists neo_fontes (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references neo_execucoes(id) on delete cascade,
  url text not null check (btrim(url) <> ''),
  titulo text,
  dominio text,
  data_observacao timestamptz,
  metadados jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists neo_fontes_execucao_id_idx on neo_fontes (execucao_id);
-- Deduplicação por execução + URL (já normalizada em minúsculas pela
-- camada de repositório antes do insert).
create unique index if not exists neo_fontes_execucao_url_idx on neo_fontes (execucao_id, url);

-- Segurança das tabelas -----------------------------------------------------

alter table neo_conversas enable row level security;
alter table neo_mensagens enable row level security;
alter table neo_execucoes enable row level security;
alter table neo_etapas enable row level security;
alter table neo_fontes enable row level security;

-- Nenhuma política é criada de propósito: sem policy, RLS nega tudo por
-- padrão para "anon"/"authenticated". Revoke explícito como camada extra,
-- igual à migration de autenticação.
revoke all on neo_conversas from anon, authenticated;
revoke all on neo_mensagens from anon, authenticated;
revoke all on neo_execucoes from anon, authenticated;
revoke all on neo_etapas from anon, authenticated;
revoke all on neo_fontes from anon, authenticated;
