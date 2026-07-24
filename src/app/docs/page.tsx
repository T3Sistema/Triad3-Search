import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Documentação — Triad3 Search",
};

const SECTIONS = [
  {
    title: "Visão geral",
    body: "O Triad3 Search é um painel operacional para a API V2 da ScrapeGraphAI. Cada ferramenta do menu lateral (Scrape, Extract, Search, Crawl e Monitor) monta uma requisição, envia para o backend deste projeto e exibe a resposta original, incluindo erros.",
  },
  {
    title: "Scrape",
    body: "Captura uma URL pública em um ou mais formatos (Markdown, HTML, Links, Imagens, Resumo, Branding, JSON estruturado ou Screenshot). Use as configurações avançadas de captura para ajustar modo, stealth, cookies, headers, rolagens, espera, timeout e país.",
  },
  {
    title: "Extract",
    body: "Extrai dados estruturados a partir de exatamente uma fonte: URL, HTML ou Markdown. O prompt é obrigatório; o schema é opcional e pode ser validado, formatado ou gerado com IA (quando disponível).",
  },
  {
    title: "Search",
    body: "Busca resultados na web. Quando um prompt é informado, a resposta também traz uma análise estruturada guiada por schema.",
  },
  {
    title: "Crawl",
    body: "Inicia um rastreamento de múltiplas páginas. O acompanhamento é feito em uma página dedicada (/crawl/[id]) com atualização automática enquanto o status for 'running', tabela de páginas paginada e exportação em JSON ou CSV.",
  },
  {
    title: "Monitor",
    body: "Cria monitoramentos agendados (cron, sempre em UTC) e acompanha a atividade de cada execução, incluindo mudanças detectadas.",
  },
  {
    title: "Histórico e créditos",
    body: "O histórico lista as requisições realizadas na sua conta da ScrapeGraphAI, com filtros por serviço. Os créditos são consultados ao abrir o painel, ao clicar em atualizar e após operações bem-sucedidas.",
  },
  {
    title: "Segurança",
    body: "A chave da API (SGAI_API_KEY) nunca é enviada ao navegador — todas as chamadas passam pelo backend deste projeto. Como não há autenticação neste painel, qualquer pessoa com acesso ao endereço público pode consumir os créditos da API. Veja o README do projeto para mais detalhes.",
  },
];

export default function DocsPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Documentação</CardTitle>
          <CardDescription>Como usar o Triad3 Search.</CardDescription>
        </CardHeader>
      </Card>
      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">{section.body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
