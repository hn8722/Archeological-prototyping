"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SessionSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export function SessionList({ initialSessions }: { initialSessions: SessionSummary[] }) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (session: SessionSummary) => {
    const shouldDelete = window.confirm(`「${session.name}」を削除しますか？`);
    if (!shouldDelete) return;

    setDeletingId(session.id);

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      setSessions((currentSessions) =>
        currentSessions.filter((currentSession) => currentSession.id !== session.id)
      );
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("セッションの削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  };

  if (sessions.length === 0) {
    return <p className="page-description">保存済みセッションはまだありません。</p>;
  }

  return (
    <div className="session-list">
      {sessions.map((session) => (
        <div key={session.id} className="session-list-row">
          <Link href={`/session/${session.id}`} className="session-link">
            <span className="session-link-name">{session.name}</span>
            <span className="session-link-meta">
              更新: {new Date(session.updatedAt).toLocaleString("ja-JP")}
            </span>
          </Link>
          <button
            type="button"
            className="session-delete-button"
            onClick={() => void handleDelete(session)}
            disabled={deletingId === session.id}
            aria-label={`${session.name}を削除`}
            title="削除"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="session-delete-icon">
              <path
                d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
