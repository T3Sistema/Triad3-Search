import { CrawlDetailPage } from "@/components/pages/crawl-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrawlDetailPage id={id} />;
}
