import { Spinner } from "@/components/ui/spinner";

export function LoadingView() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-white py-16 text-text-secondary">
      <Spinner className="h-6 w-6" />
      <p className="text-sm font-medium">Processando…</p>
    </div>
  );
}
