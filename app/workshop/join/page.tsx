import { Suspense } from "react";
import { WorkshopJoinClient } from "@/components/admin/WorkshopJoinClient";

export default function WorkshopJoinPage() {
  return (
    <Suspense fallback={<p className="admin-muted">読み込み中...</p>}>
      <WorkshopJoinClient />
    </Suspense>
  );
}
