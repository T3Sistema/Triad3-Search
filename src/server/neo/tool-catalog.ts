import "server-only";
import { NEO_TOOL_NAMES, isPersistentTool, type NeoToolName } from "@/server/neo/tool-names";

/**
 * Central documentation layer for every tool the agent can call — this is
 * what lets the model choose, combine and recover from tools on its own
 * instead of following a fixed script. Deliberately separate from each
 * tool's Zod parameter schema (still the single source of truth for
 * validation, in src/server/neo/tools/*.ts) and from its short
 * function-calling `description` (still what OpenAI sees per-call) — this
 * catalog is longer-form guidance rendered once into the agent's context
 * (src/server/neo/context-builder.ts), not repeated on every tool
 * definition.
 */
export interface NeoToolCatalogEntry {
  nome: NeoToolName;
  nomeFuncional: string;
  finalidade: string;
  quandoUsar: string;
  quandoNaoUsar: string;
  exemplos: string[];
  efeitosColaterais: string;
  timeoutMs: number;
  paralelizavel: boolean;
  custoRelativo: "baixo" | "medio" | "alto";
  errosRecuperaveis: string;
  estrategiasAlternativas: string;
}

const CATALOG: Record<NeoToolName, NeoToolCatalogEntry> = {
  pesquisar_web: {
    nome: "pesquisar_web",
    nomeFuncional: "Pesquisar",
    finalidade: "Descobrir candidatos (páginas, perfis, documentos) relacionados a um identificador já conhecido do alvo.",
    quandoUsar: "Quando ainda não se sabe qual URL/fonte tem o dado procurado — o primeiro passo típico para um alvo novo, ou para um campo ainda sem fonte candidata.",
    quandoNaoUsar: "Quando o usuário já forneceu a URL exata a analisar (comece por capturar_pagina), ou quando uma consulta equivalente já foi feita nesta mesma análise sem mudança real de estratégia.",
    exemplos: ['{"consulta":"carango.com.br CNPJ"}', '{"consulta":"sócio administrador carango comercio ltda"}'],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 30_000,
    paralelizavel: true,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout ou limite temporário do serviço — tentar novamente com a mesma consulta é seguro.",
    estrategiasAlternativas: "Se os resultados vierem irrelevantes, reformule combinando um identificador novo (razão social, cidade, telefone) descoberto nesta mesma análise — nunca repita os mesmos termos centrais.",
  },
  capturar_pagina: {
    nome: "capturar_pagina",
    nomeFuncional: "Capturar página",
    finalidade: "Ler o conteúdo completo (markdown, links, imagens ou resumo) de uma URL já conhecida.",
    quandoUsar: "Depois que uma pesquisa (ou o próprio usuário) apontou uma URL cujo título/trecho sugere ter o dado procurado.",
    quandoNaoUsar: "Nunca só porque a página tem muitos links, é uma página inicial genérica, um menu ou uma listagem sem relação clara com o objetivo pendente — isso não é evidência de nada.",
    exemplos: ['{"url":"https://empresa.example/sobre","formatos":["resumo"]}'],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 45_000,
    paralelizavel: true,
    custoRelativo: "medio",
    errosRecuperaveis: "Timeout de rede — tentar novamente é seguro; URL inválida ou bloqueada não deve ser repetida.",
    estrategiasAlternativas: "Se a página capturada não tiver o dado, volte a pesquisar apenas o campo que ainda falta, com um identificador novo.",
  },
  extrair_dados: {
    nome: "extrair_dados",
    nomeFuncional: "Extrair dados",
    finalidade: "Transformar o conteúdo de uma página (por URL já conhecida ou markdown já capturado) nos campos estruturados exatos pedidos.",
    quandoUsar: "Logo após capturar_pagina (ou quando um resultado de pesquisa já trouxer o conteúdo necessário), para obter campos específicos como CNPJ, nome, contato ou arroba — mais confiável que tentar localizar o dado só lendo o texto bruto.",
    quandoNaoUsar: "Sem uma fonte (url ou markdown) já disponível — nunca invente conteúdo para extrair dele.",
    exemplos: ['{"url":"https://empresa.example/sobre","markdown":null,"instrucao":"Extrair CNPJ e responsável","campos":["cnpj","responsavel"]}'],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 45_000,
    paralelizavel: true,
    custoRelativo: "medio",
    errosRecuperaveis: "Timeout do serviço de extração — tentar novamente com a mesma fonte é seguro.",
    estrategiasAlternativas: "Se os campos pedidos não estiverem na fonte, isso é um resultado válido (campo ausente) — não repita a extração da mesma fonte esperando um resultado diferente.",
  },
  mapear_iniciar: {
    nome: "mapear_iniciar",
    nomeFuncional: "Mapear site",
    finalidade: "Iniciar um mapeamento (crawl) de um domínio inteiro, descobrindo suas páginas.",
    quandoUsar: "Quando o pedido exige entender a estrutura completa de um site, não apenas uma página — ex.: localizar todas as páginas de um domínio, montar um sitemap.",
    quandoNaoUsar: "Para obter um único dado pontual — capturar_pagina ou pesquisar_web são muito mais baratos e rápidos para isso.",
    exemplos: ['{"url":"https://empresa.example","maxPaginas":50,"maxProfundidade":3}'],
    efeitosColaterais: "Cria um mapeamento assíncrono no backend (não persistente/recorrente) — não exige confirmação, mas tem custo operacional maior que os demais.",
    timeoutMs: 30_000,
    paralelizavel: false,
    custoRelativo: "alto",
    errosRecuperaveis: "Timeout ao iniciar — tentar novamente é seguro se nenhum mapeamento foi criado.",
    estrategiasAlternativas: "Use mapear_status/mapear_paginas para acompanhar em vez de iniciar um novo mapeamento repetido.",
  },
  mapear_status: {
    nome: "mapear_status",
    nomeFuncional: "Verificar mapeamento",
    finalidade: "Consultar o progresso/status de um mapeamento já iniciado.",
    quandoUsar: "Depois de mapear_iniciar, para saber se já há páginas suficientes para prosseguir.",
    quandoNaoUsar: "Sem um mapeamentoId válido já retornado por mapear_iniciar.",
    exemplos: ['{"mapeamentoId":"m1"}'],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 15_000,
    paralelizavel: true,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  mapear_paginas: {
    nome: "mapear_paginas",
    nomeFuncional: "Listar páginas mapeadas",
    finalidade: "Obter a lista (paginada) de URLs já descobertas por um mapeamento.",
    quandoUsar: "Quando o mapeamento já tem páginas suficientes e é hora de escolher quais capturar/extrair.",
    quandoNaoUsar: "Antes de mapear_status indicar progresso — evita paginar uma lista ainda vazia.",
    exemplos: ['{"mapeamentoId":"m1","cursor":null}'],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 15_000,
    paralelizavel: true,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  mapear_interromper: {
    nome: "mapear_interromper",
    nomeFuncional: "Interromper mapeamento",
    finalidade: "Parar um mapeamento em andamento antes de concluir.",
    quandoUsar: "Quando já há páginas suficientes e continuar mapear é desnecessário/caro.",
    quandoNaoUsar: "Em um mapeamento que já terminou.",
    exemplos: ['{"mapeamentoId":"m1"}'],
    efeitosColaterais: "Interrompe um processo assíncrono já em andamento — reversível (pode ser retomado), não exige confirmação por não ser uma ação persistente com impacto direto ao usuário.",
    timeoutMs: 15_000,
    paralelizavel: false,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  mapear_retomar: {
    nome: "mapear_retomar",
    nomeFuncional: "Retomar mapeamento",
    finalidade: "Continuar um mapeamento previamente interrompido.",
    quandoUsar: "Quando mais páginas são necessárias após uma interrupção.",
    quandoNaoUsar: "Em um mapeamento que nunca foi interrompido.",
    exemplos: ['{"mapeamentoId":"m1"}'],
    efeitosColaterais: "Reativa um processo assíncrono — não exige confirmação.",
    timeoutMs: 15_000,
    paralelizavel: false,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  monitor_criar: {
    nome: "monitor_criar",
    nomeFuncional: "Criar monitoramento",
    finalidade: "Configurar um acompanhamento recorrente de uma URL, com verificações no intervalo definido.",
    quandoUsar: 'Quando o usuário pede para "acompanhar", "monitorar" ou "avisar quando mudar" um site.',
    quandoNaoUsar: "Para uma consulta pontual (não recorrente) — use pesquisar/capturar em vez disso.",
    exemplos: ['{"nome":"Site da Carango","url":"https://carango.com.br","intervaloCron":"0 * * * *","webhookUrl":null}'],
    efeitosColaterais: "Cria um registro persistente e recorrente — SEMPRE exige confirmação explícita do usuário antes de executar.",
    timeoutMs: 20_000,
    paralelizavel: false,
    custoRelativo: "baixo",
    errosRecuperaveis: "Erro de validação (ex.: expressão cron inválida) — corrija os argumentos e tente de novo uma única vez.",
    estrategiasAlternativas: "—",
  },
  monitor_listar: {
    nome: "monitor_listar",
    nomeFuncional: "Listar monitoramentos",
    finalidade: "Listar os monitoramentos existentes do usuário, com paginação e filtro por status.",
    quandoUsar: "Quando o usuário pergunta o que já está sendo monitorado, ou antes de editar/pausar/excluir um monitoramento identificado só pelo nome.",
    quandoNaoUsar: "Quando o monitoramentoId já é conhecido.",
    exemplos: ['{"pagina":1,"limite":20,"status":null}'],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 15_000,
    paralelizavel: true,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  monitor_status: {
    nome: "monitor_status",
    nomeFuncional: "Consultar monitoramento",
    finalidade: "Obter os detalhes atuais de um monitoramento específico.",
    quandoUsar: "Para confirmar configuração atual antes de uma edição, ou responder sobre o estado de um monitoramento.",
    quandoNaoUsar: "Sem um monitoramentoId válido.",
    exemplos: ['{"monitoramentoId":"mon1"}'],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 15_000,
    paralelizavel: true,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  monitor_atualizar: {
    nome: "monitor_atualizar",
    nomeFuncional: "Editar monitoramento",
    finalidade: "Alterar nome, URL, intervalo ou webhook de um monitoramento existente.",
    quandoUsar: "Quando o usuário pede para mudar a configuração de um monitoramento já criado.",
    quandoNaoUsar: "Para criar um monitoramento novo — use monitor_criar.",
    exemplos: ['{"monitoramentoId":"mon1","intervaloCron":"0 */6 * * *"}'],
    efeitosColaterais: "Altera um registro persistente — SEMPRE exige confirmação explícita do usuário antes de executar.",
    timeoutMs: 20_000,
    paralelizavel: false,
    custoRelativo: "baixo",
    errosRecuperaveis: "Erro de validação — corrija os argumentos e tente de novo uma única vez.",
    estrategiasAlternativas: "—",
  },
  monitor_pausar: {
    nome: "monitor_pausar",
    nomeFuncional: "Pausar monitoramento",
    finalidade: "Suspender temporariamente as verificações de um monitoramento, sem excluí-lo.",
    quandoUsar: "Quando o usuário pede para pausar um monitoramento.",
    quandoNaoUsar: "Em um monitoramento já pausado.",
    exemplos: ['{"monitoramentoId":"mon1"}'],
    efeitosColaterais: "Altera o estado de um registro persistente — SEMPRE exige confirmação explícita do usuário antes de executar.",
    timeoutMs: 15_000,
    paralelizavel: false,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  monitor_retomar: {
    nome: "monitor_retomar",
    nomeFuncional: "Retomar monitoramento",
    finalidade: "Reativar as verificações de um monitoramento pausado.",
    quandoUsar: "Quando o usuário pede para retomar um monitoramento pausado.",
    quandoNaoUsar: "Em um monitoramento já ativo.",
    exemplos: ['{"monitoramentoId":"mon1"}'],
    efeitosColaterais: "Altera o estado de um registro persistente — SEMPRE exige confirmação explícita do usuário antes de executar.",
    timeoutMs: 15_000,
    paralelizavel: false,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  monitor_excluir: {
    nome: "monitor_excluir",
    nomeFuncional: "Excluir monitoramento",
    finalidade: "Remover definitivamente um monitoramento.",
    quandoUsar: "Quando o usuário pede claramente para excluir/remover um monitoramento.",
    quandoNaoUsar: "Quando pausar seria suficiente e reversível — prefira sugerir monitor_pausar se a intenção não for clara.",
    exemplos: ['{"monitoramentoId":"mon1"}'],
    efeitosColaterais: "Ação destrutiva e irreversível — SEMPRE exige confirmação explícita do usuário antes de executar, e a confirmação deve deixar claro que não pode ser desfeita.",
    timeoutMs: 15_000,
    paralelizavel: false,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  monitor_atividades: {
    nome: "monitor_atividades",
    nomeFuncional: "Consultar atividades do monitoramento",
    finalidade: "Listar o histórico de verificações/mudanças detectadas por um monitoramento.",
    quandoUsar: "Quando o usuário pergunta o que um monitoramento já detectou.",
    quandoNaoUsar: "Sem um monitoramentoId válido.",
    exemplos: ['{"monitoramentoId":"mon1","cursor":null}'],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 15_000,
    paralelizavel: true,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  consultar_historico: {
    nome: "consultar_historico",
    nomeFuncional: "Consultar histórico",
    finalidade: "Listar operações já realizadas pelo usuário nos módulos do Triad3 Search.",
    quandoUsar: "Quando o usuário pergunta sobre algo que já pesquisou/capturou/mapeou antes.",
    quandoNaoUsar: "Para dados novos que ainda não foram consultados.",
    exemplos: ['{"pagina":1,"limite":20,"servico":null}'],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 15_000,
    paralelizavel: true,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
  consultar_creditos: {
    nome: "consultar_creditos",
    nomeFuncional: "Verificar disponibilidade",
    finalidade: "Consultar os créditos/limites disponíveis no momento, server-side.",
    quandoUsar: "Apenas se relevante para decidir se uma análise ampla é viável — nunca exponha o saldo diretamente ao usuário no frontend.",
    quandoNaoUsar: "Como parte normal de uma análise de dados — é uma checagem operacional, não uma fonte de informação para o usuário.",
    exemplos: ["{}"],
    efeitosColaterais: "Nenhum — somente leitura.",
    timeoutMs: 15_000,
    paralelizavel: true,
    custoRelativo: "baixo",
    errosRecuperaveis: "Timeout — tentar novamente é seguro.",
    estrategiasAlternativas: "—",
  },
};

export function getToolCatalogEntry(nome: NeoToolName): NeoToolCatalogEntry {
  return CATALOG[nome];
}

export function listToolCatalog(): NeoToolCatalogEntry[] {
  return NEO_TOOL_NAMES.map((nome) => CATALOG[nome]);
}

/** Renders the full catalog into a compact, model-facing text block for the agent's context. */
export function buildToolCatalogPromptSection(): string {
  return listToolCatalog()
    .map((entry) => {
      const linhas = [
        `### ${entry.nome} (${entry.nomeFuncional})`,
        `Finalidade: ${entry.finalidade}`,
        `Quando usar: ${entry.quandoUsar}`,
        `Quando não usar: ${entry.quandoNaoUsar}`,
        `Efeitos colaterais: ${entry.efeitosColaterais}${isPersistentTool(entry.nome) ? " Requer confirmação explícita do usuário antes de executar." : ""}`,
        `Paralelizável: ${entry.paralelizavel ? "sim, quando independente de outras chamadas" : "não"}. Custo relativo: ${entry.custoRelativo}.`,
        `Erros recuperáveis: ${entry.errosRecuperaveis}`,
        `Estratégia alternativa: ${entry.estrategiasAlternativas}`,
      ];
      return linhas.join("\n");
    })
    .join("\n\n");
}
