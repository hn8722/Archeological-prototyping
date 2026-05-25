import { listSessionRecords } from "@/lib/server/session-store";
import { HomeClient } from "@/components/session/HomeClient";
import { getUser } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getUser();
  const sessions = user ? await listSessionRecords(user.id) : [];

  return <HomeClient initialSessions={sessions} />;
}
