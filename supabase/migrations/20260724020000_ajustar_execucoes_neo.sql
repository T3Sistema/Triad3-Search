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
--    encontrar e sincronizar a mensagem certa de forma determinística.
--
-- O backfill abaixo popula neo_execucao_id para mensagens já existentes,
-- associando cada execução à mensagem de assistente criada logo após a
-- mensagem de usuário que a originou (e antes da próxima mensagem de
-- usuário da mesma conversa, se houver). Isso é o que permite que a
-- reconciliação reconheça o estado terminal de uma execução incidente já
-- corrigida manualmente no banco sem precisar de nenhum SQL manual novo —
-- basta rodar esta migration.

alter table neo_execucoes add column if not exists ultimo_heartbeat_em timestamptz;

alter table neo_mensagens add column if not exists execucao_id uuid references neo_execucoes(id) on delete set null;

create index if not exists neo_mensagens_execucao_id_idx
  on neo_mensagens (execucao_id)
  where execucao_id is not null;

with alvo as (
  select
    ex.id as execucao_id,
    ex.conversa_id,
    um.criado_em as usuario_criado_em,
    lead(um.criado_em) over (partition by ex.conversa_id order by um.criado_em) as proximo_usuario_criado_em
  from neo_execucoes ex
  join neo_mensagens um on um.id = ex.mensagem_usuario_id
)
update neo_mensagens am
set execucao_id = alvo.execucao_id
from alvo
where am.conversa_id = alvo.conversa_id
  and am.papel = 'assistente'
  and am.execucao_id is null
  and am.criado_em > alvo.usuario_criado_em
  and (alvo.proximo_usuario_criado_em is null or am.criado_em < alvo.proximo_usuario_criado_em);
