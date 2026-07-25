-- Memória estruturada de entidades para o agente conversacional do Neo.
--
-- Coluna aditiva única, nenhuma alteração destrutiva: neo_conversas.entidades_ativas
-- guarda a memória de entidades (pessoas, empresas, domínios, perfis sociais,
-- endereços, telefones, e-mails) já reconhecidas nesta conversa — ver
-- src/lib/neo/entity.ts e src/server/neo/entity-memory.ts. É o que permite ao
-- Neo resolver "dela"/"a outra empresa" em uma mensagem de continuação e
-- nunca colapsar dois CNPJs diferentes só porque têm o mesmo nome: o merge é
-- feito inteiramente em código (nunca pelo modelo) e só une duas entidades
-- quando o identificador canônico (CNPJ, domínio, e-mail) é exatamente igual.
--
-- Populada ao final de cada relatório concluído, nunca durante uma etapa
-- técnica isolada — nula até a primeira análise concluída de uma conversa.

alter table neo_conversas add column if not exists entidades_ativas jsonb;
