import { SessionWorkspace } from "@/components/editor/SessionWorkspace";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SessionWorkspace sessionId={id} />;
}
