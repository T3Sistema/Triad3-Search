import { MonitorDetailPage } from "@/components/pages/monitor-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MonitorDetailPage id={id} />;
}
