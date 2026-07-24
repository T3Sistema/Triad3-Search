-- Autenticação própria do Triad3 Search.
--
-- Este banco Supabase é usado exclusivamente como PostgreSQL: nenhuma
-- funcionalidade do Supabase Auth é utilizada. Usuários, senhas, sessões e
-- tentativas de login são controlados inteiramente por estas tabelas e pelo
-- backend do próprio projeto (ver src/server/auth/ e src/server/db/).
--
-- RLS é habilitado como camada extra de defesa: nenhuma política é criada
-- para "anon"/"authenticated" (os papéis usados pela chave publicável do
-- PostgREST), então essas chaves nunca conseguem ler ou escrever aqui. O
-- único acesso real acontece pelo backend, autenticado com a chave secreta
-- server-only (SUPABASE_SECRET_KEY), que ignora RLS por padrão no Supabase.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- usuarios ------------------------------------------------------------------

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  email citext not null check (btrim(email::text) <> ''),
  password_hash text not null check (btrim(password_hash) <> ''),
  ativo boolean not null default true,
  tentativas_falhas integer not null default 0,
  bloqueado_ate timestamptz,
  ultimo_login_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- citext já compara sem diferenciar maiúsculas/minúsculas; o índice único
-- abaixo garante e-mail único de forma case-insensitive.
create unique index if not exists usuarios_email_key on usuarios (email);

create or replace function triad3_set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists usuarios_set_atualizado_em on usuarios;
create trigger usuarios_set_atualizado_em
  before update on usuarios
  for each row
  execute function triad3_set_atualizado_em();

-- sessoes ---------------------------------------------------------------

create table if not exists sessoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  token_hash text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  ultimo_acesso_em timestamptz not null default now(),
  revogado_em timestamptz,
  user_agent text,
  ip_hash text
);

create index if not exists sessoes_usuario_id_idx on sessoes (usuario_id);
create index if not exists sessoes_expira_em_idx on sessoes (expira_em);

-- tentativas_login --------------------------------------------------------
-- Registro persistente de tentativas de login (sucesso ou falha), usado para
-- limitar tentativas de força bruta de forma consistente em ambiente
-- serverless (onde memória local não sobrevive entre invocações). Guarda
-- apenas hashes de e-mail/IP, nunca o valor original.

create table if not exists tentativas_login (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null,
  ip_hash text,
  sucesso boolean not null,
  criado_em timestamptz not null default now()
);

create index if not exists tentativas_login_email_hash_criado_em_idx
  on tentativas_login (email_hash, criado_em desc);

-- Segurança das tabelas ----------------------------------------------------

alter table usuarios enable row level security;
alter table sessoes enable row level security;
alter table tentativas_login enable row level security;

-- Nenhuma política é criada de propósito: sem policy, RLS nega tudo por
-- padrão para quem não tem BYPASSRLS (ou seja, para "anon" e
-- "authenticated"). Revogamos os privilégios padrão também, como camada
-- adicional independente de RLS.
revoke all on usuarios from anon, authenticated;
revoke all on sessoes from anon, authenticated;
revoke all on tentativas_login from anon, authenticated;
