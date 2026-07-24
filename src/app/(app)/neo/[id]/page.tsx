import { NeoPage } from "@/components/neo/neo-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NeoPage conversaId={id} />;
}
