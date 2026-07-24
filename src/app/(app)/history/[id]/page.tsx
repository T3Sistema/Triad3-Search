import { HistoryDetailPage } from "@/components/pages/history-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HistoryDetailPage id={id} />;
}
