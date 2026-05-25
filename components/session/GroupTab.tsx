"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type GroupSession = {
  id: string;
  name: string;
  role: string;
  ownerId: string | null;
  updatedAt: string;
};

type MemberModalState = { sessionId: string; sessionName: string } | null;

export function GroupTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 新規グループ作成
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // メンバー追加モーダル
  const [memberModal, setMemberModal] = useState<MemberModalState>(null);
  const [inviteUserId, setInviteUserId] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/group/sessions")
      .then((r) => r.json())
      .then((data: { sessions: GroupSession[] }) => setSessions(data.sessions))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleCreateGroup = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/group/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() || undefined }),
      });
      if (!response.ok) throw new Error("Failed to create group");
      const data = (await response.json()) as { session: { id: string } };
      router.push(`/session/${data.session.id}`);
    } catch (error) {
      console.error(error);
      alert("グループの作成に失敗しました。");
      setIsCreating(false);
    }
  };

  const openMemberModal = (session: GroupSession) => {
    setMemberModal({ sessionId: session.id, sessionName: session.name });
    setInviteUserId("");
    setInviteError(null);
    setInviteSuccess(false);
  };

  const closeMemberModal = () => {
    setMemberModal(null);
    setInviteUserId("");
    setInviteError(null);
    setInviteSuccess(false);
  };

  const handleInvite = async () => {
    if (!memberModal || !inviteUserId.trim()) return;
    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      const response = await fetch(`/api/group/sessions/${memberModal.sessionId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: inviteUserId.trim() }),
      });
      if (!response.ok) throw new Error("Failed to invite");
      setInviteSuccess(true);
      setInviteUserId("");
    } catch (error) {
      console.error(error);
      setInviteError("招待に失敗しました。ユーザーIDを確認してください。");
    } finally {
      setIsInviting(false);
    }
  };

  if (isLoading) {
    return <p className="home-placeholder">読み込み中...</p>;
  }

  return (
    <>
      {/* 新規グループ作成 */}
      <div className="group-create-area">
        {!showCreateForm ? (
          <button
            className="group-create-btn"
            onClick={() => setShowCreateForm(true)}
          >
            + 新規グループプロジェクトを作成
          </button>
        ) : (
          <div className="group-create-form">
            <input
              className="home-new-input"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isCreating) void handleCreateGroup(); }}
              placeholder="グループ名（任意）"
              disabled={isCreating}
              autoFocus
            />
            <button
              className="button-primary"
              onClick={() => void handleCreateGroup()}
              disabled={isCreating}
            >
              {isCreating ? "作成中..." : "作成して開始"}
            </button>
            <button
              className="group-create-cancel"
              onClick={() => { setShowCreateForm(false); setNewGroupName(""); }}
              disabled={isCreating}
            >
              キャンセル
            </button>
          </div>
        )}
      </div>

      {/* グループ一覧 */}
      {sessions.length === 0 ? (
        <p className="home-placeholder">
          参加中のグループはまだありません。
        </p>
      ) : (
        <div className="session-list">
          {sessions.map((session) => (
            <div key={session.id} className="session-list-row group-session-row">
              <Link href={`/session/${session.id}`} className="session-link">
                <span className="session-link-name">{session.name}</span>
                <span className="session-link-meta">
                  {session.role === "owner" ? "管理者" : "メンバー"} ・
                  更新: {new Date(session.updatedAt).toLocaleString("ja-JP")}
                </span>
              </Link>
              {session.role === "owner" && (
                <button
                  type="button"
                  className="session-invite-btn"
                  onClick={() => openMemberModal(session)}
                  title="メンバーを招待"
                >
                  招待
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 招待モーダル */}
      {memberModal && (
        <div className="modal-overlay" onClick={closeMemberModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">メンバーを招待</h2>
              <button className="modal-close" onClick={closeMemberModal}>✕</button>
            </div>
            <p className="invite-modal-desc">
              「{memberModal.sessionName}」に招待するユーザーIDを入力してください。
            </p>
            <div className="invite-modal-form">
              <input
                className="login-input"
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
                placeholder="ユーザーID"
                disabled={isInviting}
                autoFocus
              />
              <button
                className="button-primary"
                onClick={() => void handleInvite()}
                disabled={isInviting || !inviteUserId.trim()}
              >
                {isInviting ? "招待中..." : "招待する"}
              </button>
            </div>
            {inviteError && <p className="invite-modal-error">{inviteError}</p>}
            {inviteSuccess && <p className="invite-modal-success">招待しました。</p>}
          </div>
        </div>
      )}
    </>
  );
}
