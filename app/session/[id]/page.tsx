import { SessionWorkspace } from "@/components/editor/SessionWorkspace";

export default function SessionPage({
  params,
}: {
  params: { id: string };
}) {
  return <SessionWorkspace sessionId={params.id} />;
}