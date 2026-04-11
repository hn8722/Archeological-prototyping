import Link from "next/link";
import { listSessionRecords } from "@/lib/server/session-store";
import { SessionList } from "@/components/session/SessionList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sessions = await listSessionRecords();

  return (
    <div className="page-container">
      <h1 className="page-title">AP Story App</h1>
      <p className="page-description">
        APモデルに基づいて、世代ごとのノード・エッジを記述し、小説生成まで行うアプリです。
      </p>

      <div className="card-list">
        <div className="card">
          <h2>新規セッション作成</h2>
          <p>空のAPモデルから新しい作業を開始します。</p>
          <Link href="/session/new" className="button-primary">
            新規作成
          </Link>
        </div>

        <div className="card">
          <h2>既存セッションを開く</h2>
          <p>保存済みの作業を選んで再開します。</p>
          <SessionList initialSessions={sessions} />
        </div>
      </div>
    </div>
  );
}
