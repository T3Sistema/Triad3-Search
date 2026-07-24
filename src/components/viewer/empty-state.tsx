import { Inbox } from "lucide-react";

export function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-white py-16 text-center text-text-secondary">
      <Inbox className="h-6 w-6" aria-hidden="true" />
      <p className="max-w-xs text-sm">
        {message ?? "Configure a requisição e clique em Executar. O resultado será exibido aqui."}
      </p>
    </div>
  );
}
