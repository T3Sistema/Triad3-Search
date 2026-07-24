import "server-only";

/** Friendly, pt-BR description of a persistent action, shown on the confirmation card — never raw args/JSON. */
export function describeConfirmation(toolName: string, args: Record<string, unknown>): string {
  const url = typeof args.url === "string" ? args.url : undefined;
  const nome = typeof args.nome === "string" ? args.nome : undefined;
  const intervalo = typeof args.intervaloCron === "string" ? args.intervaloCron : undefined;
  const id = typeof args.monitoramentoId === "string" ? args.monitoramentoId : undefined;

  switch (toolName) {
    case "monitor_criar":
      return `Criar um monitoramento${nome ? ` chamado "${nome}"` : ""}${url ? ` para ${url}` : ""}${intervalo ? `, verificando no intervalo "${intervalo}"` : ""}.`;
    case "monitor_atualizar":
      return `Atualizar o monitoramento${id ? ` ${id}` : ""}${nome ? ` para o nome "${nome}"` : ""}${url ? `, apontando para ${url}` : ""}${intervalo ? `, com intervalo "${intervalo}"` : ""}.`;
    case "monitor_pausar":
      return `Pausar o monitoramento${id ? ` ${id}` : ""}.`;
    case "monitor_retomar":
      return `Retomar o monitoramento${id ? ` ${id}` : ""}.`;
    case "monitor_excluir":
      return `Excluir definitivamente o monitoramento${id ? ` ${id}` : ""}. Esta ação não pode ser desfeita.`;
    default:
      return "Executar uma ação com efeito persistente.";
  }
}
