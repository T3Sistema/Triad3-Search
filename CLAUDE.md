@AGENTS.md

## Regras permanentes de produto

Estas regras são políticas permanentes do Triad3 Search. Não as remova nem as enfraqueça ao editar
este arquivo — apenas acrescente. Ver também `.claude/rules/frontend-product-rules.md` para o
detalhamento completo (paths, paleta, arquitetura, checklist).

1. Todo texto visível deve estar em português do Brasil.
2. O nome `Triad3 Search` não pode ser traduzido.
3. O fundo global é `#DBE2E9`.
4. A interface é exclusivamente clara (sem tema escuro).
5. Nenhum fornecedor pode ser identificado no frontend.
6. Integrações externas devem permanecer server-only.
7. Erros externos devem ser neutralizados antes de chegar ao navegador.
8. Resultados legítimos pesquisados pelo usuário não devem ser censurados.
9. Toda nova integração deve adicionar seus identificadores à lista de termos proibidos no frontend
   (`scripts/ui-policy.config.mjs`).
10. Antes de concluir qualquer alteração de frontend, executar `npm run check:ui-policy` (a
    verificação da política visual e de neutralização).

### Neo — agente conversacional (regras permanentes adicionais)

Estas regras descrevem a arquitetura de decisão do Neo e são tão permanentes quanto as anteriores.
Ver `.claude/rules/frontend-product-rules.md` seção 7 para o detalhamento técnico já existente.

11. O Neo é um agente conversacional com acesso a ferramentas — nunca um fluxo rígido de etapas fixas
    (não existe "pesquisar N vezes / capturar M páginas / extrair / encerrar" como roteiro obrigatório).
12. Quem escolhe as ferramentas, os parâmetros e a estratégia a cada turno é o modelo, dentro do loop
    único do agente (`src/server/neo/agent.ts`) — nunca uma sequência de chamadas de decisão
    encadeadas e desconectadas entre si.
13. Quem valida, autoriza, aplica limites, confirma e executa é sempre o backend — o modelo decide o
    que fazer, o backend decide o que é permitido.
14. O resultado de toda ferramenta volta para o mesmo ciclo do agente, que analisa e decide o próximo
    passo naturalmente — nunca uma chamada de avaliação separada após cada rodada.
15. As ferramentas manuais (capturar, extrair, pesquisar, mapear, monitoramentos, histórico, créditos)
    e o Neo compartilham a mesma camada de serviços (`src/server/services/*`) — o Neo nunca duplica
    lógica nem chama rotas HTTP internas desnecessariamente.
16. Toda ação com efeito persistente (criar/editar/pausar/retomar/excluir monitoramento, interromper
    mapeamento) exige confirmação explícita do usuário antes de executar — nunca dispara direto a
    partir de uma decisão do modelo.
17. Uma resposta simples (conversa, esclarecimento, confirmação, formulário) nunca é forçada na
    estrutura de Relatório de Inteligência — só tarefas de coleta de dados geram relatório.
18. Nenhuma etapa técnica (nome de ferramenta, contagem de chamadas, erro técnico, nome de módulo)
    vira conteúdo visível ao usuário — nem em texto de resposta, nem em relatório.
19. O contexto da conversa (resumo, entidades ativas, resultados reutilizáveis, ferramentas já
    executadas) deve ser reaproveitado entre turnos — o Neo nunca repete uma chamada cujo resultado
    já está persistido, nem reenvia o histórico inteiro indefinidamente.
20. Uma execução gera no máximo uma resposta do Neo — reconexão, atualização de página ou eventos
    duplicados de streaming nunca duplicam a mensagem final.
21. CNPJs, domínios e outras entidades com identificador próprio nunca são colapsados por terem o
    mesmo nome/rótulo — o merge de entidades só ocorre por identificador canônico exato
    (`src/server/neo/entity-memory.ts`).
22. `store: false` e o modelo fixo do Neo permanecem configurados apenas no backend — nunca expostos,
    parametrizáveis pelo frontend, nem substituídos por fallback silencioso para outro modelo.
23. Nenhum raciocínio privado do modelo é persistido — apenas decisão pública, ferramentas chamadas,
    parâmetros permitidos, resultados, evidências, status e resposta final.
