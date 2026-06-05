import { redirect } from "next/navigation";
import { WorkshopAdminClient } from "@/components/admin/WorkshopAdminClient";
import { getUser } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function WorkshopAdminPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return <WorkshopAdminClient />;
}
