"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type WorkshopMember = {
  userId: string;
  role: string;
  joinedAt: string;
};

type WorkshopSession = {
  id: string;
  name: string;
  ownerId: string | null;
  workshopCode: string | null;
  workshopStatus: string;
  workshopAllowReadAfterClose: boolean;
  workshopAllowAi: boolean;
  workshopClosedAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  storyCount: number;
  members: WorkshopMember[];
};

type WorkshopStory = {
  id: string;
  content: string;
  model: string | null;
  createdAt: string;
};

function statusLabel(status: string) {
  if (status === "open") return "開催中";
  if (status === "closed") return "終了";
  return "準備中";
}

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Date(date).toLocaleString("ja-JP");
}

function truncateId(value: string) {
  if (value.includes("@")) return value;
  return `${value.slice(0, 8)}...`;
}

export function WorkshopAdminClient() {
  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [onlineCounts, setOnlineCounts] = useState<Record<string, number>>({});
  const [storiesFor, setStoriesFor] = useState<WorkshopSession | null>(null);
  const [stories, setStories] = useState<WorkshopStory[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [ownerTransferValues, setOwnerTransferValues] = useState<Record<string, string>>({});
  const browserOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || browserOrigin).replace(/\/$/, "");
  const isUsingLocalJoinOrigin =
    appOrigin.includes("localhost") || appOrigin.includes("127.0.0.1");

  const loadSessions = async () => {
    const response = await fetch("/api/admin/workshops");
    if (!response.ok) throw new Error("Failed to load workshops");
    const data = (await response.json()) as { sessions: WorkshopSession[] };
    setSessions(data.sessions);
  };

  useEffect(() => {
    loadSessions()
      .catch((error) => {
        console.error(error);
        alert("ワークショップ一覧を読み込めませんでした。");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (sessions.length === 0) {
      setOnlineCounts({});
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const channels = sessions.map((session) => {
      const channel = supabase.channel(`presence:${session.id}`);
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCounts((current) => ({
          ...current,
          [session.id]: Object.keys(state).length,
        }));
      });
      channel.subscribe();
      return channel;
    });

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [sessions.map((session) => session.id).join("|")]);

  const refreshFromResponse = async (response: Response) => {
    if (!response.ok) throw new Error("Request failed");
    const data = (await response.json()) as { sessions?: WorkshopSession[] };
    if (data.sessions) setSessions(data.sessions);
  };

  const createWorkshop = async () => {
    setBusyId("create");
    try {
      const response = await fetch("/api/admin/workshops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() || "ワークショップグループ" }),
      });
      await refreshFromResponse(response);
      setNewName("");
    } catch (error) {
      console.error(error);
      alert("グループを作成できませんでした。");
    } finally {
      setBusyId(null);
    }
  };

  const patchWorkshop = async (session: WorkshopSession, body: Partial<WorkshopSession>) => {
    setBusyId(session.id);
    try {
      const response = await fetch(`/api/admin/workshops/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await refreshFromResponse(response);
    } catch (error) {
      console.error(error);
      alert("更新できませんでした。");
    } finally {
      setBusyId(null);
    }
  };

  const generateCode = async (session: WorkshopSession) => {
    setBusyId(session.id);
    try {
      const response = await fetch(`/api/admin/workshops/${session.id}/code`, { method: "POST" });
      await refreshFromResponse(response);
    } catch (error) {
      console.error(error);
      alert("参加コードを発行できませんでした。");
    } finally {
      setBusyId(null);
    }
  };

  const deleteWorkshop = async (session: WorkshopSession) => {
    if (!window.confirm(`「${session.name}」を削除しますか？APデータと小説も削除されます。`)) return;
    setBusyId(session.id);
    try {
      const response = await fetch(`/api/admin/workshops/${session.id}`, { method: "DELETE" });
      await refreshFromResponse(response);
    } catch (error) {
      console.error(error);
      alert("削除できませんでした。");
    } finally {
      setBusyId(null);
    }
  };

  const transferOwner = async (session: WorkshopSession) => {
    const nextOwnerId = ownerTransferValues[session.id]?.trim();
    if (!nextOwnerId) return;
    if (
      !window.confirm(
        `「${session.name}」の管理者を入力されたuser.idへ移譲します。移譲後、この一覧から見えなくなる場合があります。`
      )
    ) {
      return;
    }

    setBusyId(session.id);
    try {
      const response = await fetch(`/api/admin/workshops/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: nextOwnerId }),
      });
      await refreshFromResponse(response);
      setOwnerTransferValues((current) => ({ ...current, [session.id]: "" }));
    } catch (error) {
      console.error(error);
      alert("所有者を変更できませんでした。");
    } finally {
      setBusyId(null);
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const openStories = async (session: WorkshopSession) => {
    setStoriesFor(session);
    setStories([]);
    setStoriesLoading(true);
    try {
      const response = await fetch(`/api/admin/workshops/${session.id}/stories`);
      if (!response.ok) throw new Error("Failed to load stories");
      const data = (await response.json()) as { stories: WorkshopStory[] };
      setStories(data.stories);
    } catch (error) {
      console.error(error);
      alert("小説データを読み込めませんでした。");
    } finally {
      setStoriesLoading(false);
    }
  };

  const totalMembers = useMemo(
    () => sessions.reduce((sum, session) => sum + session.memberCount, 0),
    [sessions]
  );

  if (isLoading) {
    return <p className="admin-muted">読み込み中...</p>;
  }

  return (
    <div className="workshop-admin">
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Workshop Admin</p>
          <h1>ワークショップ管理</h1>
          <p>
            グループごとの参加コード、開催状態、AI利用、データ確認を管理します。
          </p>
        </div>
        <div className="admin-summary">
          <span>{sessions.length} groups</span>
          <span>{totalMembers} members</span>
        </div>
      </section>

      <section className="admin-create-bar">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="新しいグループ名"
          onKeyDown={(event) => {
            if (event.key === "Enter" && busyId !== "create") void createWorkshop();
          }}
        />
        <button type="button" onClick={() => void createWorkshop()} disabled={busyId === "create"}>
          グループ作成
        </button>
      </section>

      {isUsingLocalJoinOrigin && (
        <p className="admin-url-warning">
          QR/参加リンクがローカルURLで作られています。本番配布用には
          NEXT_PUBLIC_APP_URL に公開URLを設定してください。
        </p>
      )}

      {sessions.length === 0 ? (
        <p className="admin-muted">管理中のワークショップグループはまだありません。</p>
      ) : (
        <div className="workshop-grid">
          {sessions.map((session) => {
            const joinUrl = session.workshopCode
              ? `${appOrigin}/workshop/join?code=${encodeURIComponent(session.workshopCode)}`
              : "";
            const qrUrl = joinUrl
              ? `https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(joinUrl)}`
              : "";
            const isBusy = busyId === session.id;

            return (
              <article key={session.id} className="workshop-card">
                <div className="workshop-card-header">
                  <input
                    className="workshop-name-input"
                    value={session.name}
                    onChange={(event) => {
                      const nextName = event.target.value;
                      setSessions((current) =>
                        current.map((item) =>
                          item.id === session.id ? { ...item, name: nextName } : item
                        )
                      );
                    }}
                    onBlur={() => void patchWorkshop(session, { name: session.name })}
                    disabled={isBusy}
                  />
                  <span className={`workshop-status workshop-status-${session.workshopStatus}`}>
                    {statusLabel(session.workshopStatus)}
                  </span>
                </div>

                <div className="workshop-code-panel">
                  <div>
                    <span className="admin-label">参加コード</span>
                    <strong>{session.workshopCode ?? "未発行"}</strong>
                  </div>
                  <button type="button" onClick={() => void generateCode(session)} disabled={isBusy}>
                    {session.workshopCode ? "再発行" : "発行"}
                  </button>
                </div>

                {joinUrl && (
                  <div className="workshop-join-panel">
                    <img src={qrUrl} alt={`${session.name} の参加QRコード`} />
                    <div>
                      <span className="admin-label">参加リンク</span>
                      <p>{joinUrl}</p>
                      <button type="button" onClick={() => void copyText(joinUrl)}>
                        リンクコピー
                      </button>
                    </div>
                  </div>
                )}

                <div className="workshop-metrics">
                  <span>参加者 {session.memberCount}</span>
                  <span>オンライン {onlineCounts[session.id] ?? 0}</span>
                  <span>小説 {session.storyCount}</span>
                </div>

                <div className="workshop-toggles">
                  <label>
                    <input
                      type="checkbox"
                      checked={session.workshopAllowReadAfterClose}
                      onChange={(event) =>
                        void patchWorkshop(session, {
                          workshopAllowReadAfterClose: event.target.checked,
                        })
                      }
                    />
                    終了後も閲覧可
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={session.workshopAllowAi}
                      onChange={(event) =>
                        void patchWorkshop(session, { workshopAllowAi: event.target.checked })
                      }
                    />
                    AI利用を許可
                  </label>
                </div>

                <details className="workshop-members">
                  <summary>参加者名一覧</summary>
                  {session.members.length === 0 ? (
                    <p className="admin-muted">参加者はまだいません。</p>
                  ) : (
                    <ul>
                      {session.members.map((member) => (
                        <li key={`${member.userId}-${member.joinedAt}`}>
                          <span>{truncateId(member.userId)}</span>
                          <small>{member.role} / {formatDate(member.joinedAt)}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>

                <div className="workshop-owner-transfer">
                  <span className="admin-label">所有者変更</span>
                  <p>新しい管理者のSupabase user.idを入力してください。</p>
                  <div>
                    <input
                      value={ownerTransferValues[session.id] ?? ""}
                      onChange={(event) =>
                        setOwnerTransferValues((current) => ({
                          ...current,
                          [session.id]: event.target.value,
                        }))
                      }
                      placeholder="new owner user.id"
                      disabled={isBusy}
                    />
                    <button
                      type="button"
                      onClick={() => void transferOwner(session)}
                      disabled={isBusy || !(ownerTransferValues[session.id] ?? "").trim()}
                    >
                      移譲
                    </button>
                  </div>
                </div>

                <div className="workshop-actions">
                  <button
                    type="button"
                    onClick={() =>
                      void patchWorkshop(session, {
                        workshopStatus: session.workshopStatus === "open" ? "closed" : "open",
                      })
                    }
                    disabled={isBusy}
                  >
                    {session.workshopStatus === "open" ? "終了する" : "開始する"}
                  </button>
                  <Link href={`/session/${session.id}`}>APデータを見る</Link>
                  <button type="button" onClick={() => void openStories(session)}>
                    小説データを見る
                  </button>
                  <a href={`/api/admin/workshops/${session.id}/export`}>データ出力</a>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void deleteWorkshop(session)}
                    disabled={isBusy}
                  >
                    削除
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {storiesFor && (
        <div className="modal-overlay" onClick={() => setStoriesFor(null)}>
          <div className="modal-card story-admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{storiesFor.name} の小説データ</h2>
              <button className="modal-close" onClick={() => setStoriesFor(null)}>
                x
              </button>
            </div>
            {storiesLoading ? (
              <p className="admin-muted">読み込み中...</p>
            ) : stories.length === 0 ? (
              <p className="admin-muted">保存された小説はまだありません。</p>
            ) : (
              <div className="story-admin-list">
                {stories.map((story) => (
                  <article key={story.id}>
                    <header>
                      <strong>{formatDate(story.createdAt)}</strong>
                      {story.model && <span>{story.model}</span>}
                    </header>
                    <pre>{story.content}</pre>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
