-- Correção do travamento de investigações do Neo em produção.
--
-- Duas colunas aditivas, nenhuma alteração destrutiva:
--
-- 1) neo_execucoes.ultimo_heartbeat_em — permite que o backend detecte uma
--    execução órfã (função da Vercel encerrada abruptamente antes de gravar
--    um status terminal) sem depender apenas de `iniciado_em`, já que uma
--    investigação legítima e longa pode ficar minutos entre heartbeats de
--    "iniciado" e o primeiro evento real.
--
-- 2) neo_mensagens.execucao_id — vínculo direto e estável entre a mensagem
--    "placeholder" do assistente e a execução que a preenche. Antes desta
--    migration esse vínculo só existia de forma heurística em memória
--    (a mensagem de assistente mais recente com status 'em_execucao'), o que
--    é exatamente por que um status terminal já salvo em neo_execucoes podia
--    nunca chegar a neo_mensagens: nada consultava as duas tabelas juntas.
--    Com a FK, a reconciliação (src/server/neo/reconciliation.ts) consegue
--    encontrar e sincronizar a mensagem certa de forma determinística. O
--    índice é único (por execucao_id, ignorando nulos): a arquitetura já
--    garante 1:1 (cada startNeoExecution cria exatamente uma mensagem de
--    assistente por execução), então o banco também passa a impedir que uma
--    execução acabe vinculada a mais de uma mensagem.
--
-- O backfill abaixo popula execucao_id para mensagens já existentes. Para
-- cada execução, vincula SOMENTE a mensagem de assistente mais próxima
-- (menor criado_em, com id como desempate) que vem depois da mensagem de
-- usuário que originou a execução e antes da próxima mensagem de usuário da
-- mesma conversa — nunca todas as mensagens de assistente nesse intervalo.
-- O limite superior da janela ("próxima mensagem de usuário") é calculado a
-- partir de TODAS as mensagens de usuário da conversa, não só as que têm
-- execução — uma mensagem de usuário órfã (ex.: o processo caiu entre
-- inserir a mensagem e criar a execução) ainda assim fecha corretamente a
-- janela da execução anterior, em vez de deixá-la se estender e capturar uma
-- mensagem de assistente que não é dela. Nunca sobrescreve um execucao_id já
-- preenchido — idempotente: rodar de novo não altera nada. Isso é o que
-- permite que a reconciliação reconheça o estado terminal de uma execução
-- incidente já corrigida manualmente no banco sem precisar de nenhum SQL
-- manual novo — basta rodar esta migration.

alter table neo_execucoes add column if not exists ultimo_heartbeat_em timestamptz;

alter table neo_mensagens add column if not exists execucao_id uuid references neo_execucoes(id) on delete set null;

create unique index if not exists neo_mensagens_execucao_id_idx
  on neo_mensagens (execucao_id)
  where execucao_id is not null;

with usuario_janelas as (
  select
    um.id as mensagem_usuario_id,
    um.conversa_id,
    um.criado_em as usuario_criado_em,
    lead(um.criado_em) over (partition by um.conversa_id order by um.criado_em, um.id) as proximo_usuario_criado_em,
    lead(um.id) over (partition by um.conversa_id order by um.criado_em, um.id) as proximo_usuario_id
  from neo_mensagens um
  where um.papel = 'usuario'
),
-- Propositalmente NÃO filtra "am.execucao_id is null" aqui: o "mais próxima"
-- precisa ser calculado sobre a mesma janela de candidatas sempre, mesmo se
-- rodado de novo depois de um backfill parcial — senão, numa segunda
-- execução, a mensagem correta (já vinculada) sairia da lista de candidatas
-- e a mensagem espúria seguinte passaria a parecer "a mais próxima",
-- roubando o vínculo. O filtro "is null" entra só no UPDATE final, que por
-- sua vez nunca sobrescreve — o índice único acima é a rede de segurança
-- caso essa invariante seja quebrada no futuro.
candidatos as (
  select
    ex.id as execucao_id,
    am.id as mensagem_assistente_id,
    row_number() over (
      partition by ex.id
      order by am.criado_em asc, am.id asc
    ) as posicao
  from neo_execucoes ex
  join usuario_janelas uj on uj.mensagem_usuario_id = ex.mensagem_usuario_id
  join neo_mensagens am
    on am.conversa_id = uj.conversa_id
   and am.papel = 'assistente'
   and (am.criado_em, am.id) > (uj.usuario_criado_em, uj.mensagem_usuario_id)
   and (
     uj.proximo_usuario_criado_em is null
     or (am.criado_em, am.id) < (uj.proximo_usuario_criado_em, uj.proximo_usuario_id)
   )
)
update neo_mensagens am
set execucao_id = candidatos.execucao_id
from candidatos
where am.id = candidatos.mensagem_assistente_id
  and candidatos.posicao = 1
  and am.execucao_id is null;
