import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Ajuda — Triad3 Search",
};

const SECTIONS = [
  {
    title: "Visão geral",
    body: "O Triad3 Search é um painel para capturar, extrair, pesquisar, mapear e monitorar páginas da web. Cada ferramenta do menu lateral monta uma requisição, envia para o backend deste projeto e exibe a resposta, incluindo eventuais erros.",
  },
  {
    title: "Capturar",
    body: "Captura uma URL pública em um ou mais formatos (Markdown, HTML, Links, Imagens, Resumo, Branding, JSON estruturado ou Screenshot). Use as configurações avançadas de captura para ajustar modo, navegação furtiva, cookies, headers, rolagens, espera, tempo limite e país.",
  },
  {
    title: "Extrair",
    body: "Extrai dados estruturados a partir de exatamente uma fonte: URL, HTML ou Markdown. O prompt é obrigatório; o schema é opcional e pode ser validado, formatado ou gerado automaticamente (quando disponível).",
  },
  {
    title: "Pesquisar",
    body: "Busca resultados na web. Quando um prompt é informado, a resposta também traz uma análise estruturada guiada por schema.",
  },
  {
    title: "Mapear site",
    body: "Inicia um rastreamento de múltiplas páginas a partir de uma URL. O acompanhamento é feito em uma página dedicada, com atualização automática enquanto o mapeamento estiver em execução, tabela de páginas paginada e exportação em JSON ou CSV.",
  },
  {
    title: "Monitorar",
    body: "Cria monitoramentos agendados (intervalo no formato cron, sempre em UTC) e acompanha a atividade de cada execução, incluindo mudanças detectadas na página.",
  },
  {
    title: "Histórico e créditos",
    body: "O histórico lista as requisições realizadas neste painel, com filtros por serviço. Os créditos são consultados ao abrir o painel, ao clicar em atualizar e após operações bem-sucedidas.",
  },
  {
    title: "Segurança e privacidade",
    body: "As credenciais que sustentam a integração nunca são enviadas ao navegador — todas as chamadas passam pelo backend deste projeto. Como não há autenticação neste painel, qualquer pessoa com acesso ao endereço público pode utilizar a integração configurada. Consulte o README do projeto para mais detalhes.",
  },
];

export default function DocsPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Ajuda</CardTitle>
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
