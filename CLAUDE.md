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
