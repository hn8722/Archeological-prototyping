"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionSummary = {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export function SessionList({ initialSessions }: { initialSessions: SessionSummary[] }) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: { sessions: SessionSummary[] }) => setSessions(data.sessions))
      .catch(console.error);
  }, []);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleDelete = async (session: SessionSummary) => {
    const shouldDelete = window.confirm(`「${session.name}」を削除しますか？`);
    if (!shouldDelete) return;

    setDeletingId(session.id);
    try {
      const response = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete session");
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("セッションの削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublic = async (session: SessionSummary) => {
    setTogglingId(session.id);
    const next = !session.isPublic;
    try {
      const response = await fetch(`/api/sessions/${session.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!response.ok) throw new Error("Failed to update");
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, isPublic: next } : s))
      );
    } catch (error) {
      console.error(error);
      alert("公開設定の更新に失敗しました。");
    } finally {
      setTogglingId(null);
    }
  };

  if (sessions.length === 0) {
    return <p className="home-placeholder">保存済みセッションはまだありません。</p>;
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

          <label
            className="toggle-label"
            title={session.isPublic ? "公開中（クリックで非公開）" : "非公開（クリックで公開）"}
          >
            <input
              type="checkbox"
              className="toggle-input"
              checked={session.isPublic}
              disabled={togglingId === session.id}
              onChange={() => void handleTogglePublic(session)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-text">
              {session.isPublic ? "公開" : "非公開"}
            </span>
          </label>

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
