"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { LeftPanel } from "./LeftPanel";
import { CenterGraph } from "./CenterGraph";
import { RightPanel } from "./RightPanel";
import { useSessionStore } from "@/store/useSessionStore";
import { mockSession } from "@/lib/data/mockSession";
import { SessionModel, SessionPatch } from "@/lib/types/ap";
import { useSessionRealtime } from "@/lib/realtime/useSessionRealtime";
import { useOnlineMembers } from "@/lib/realtime/useOnlineMembers";

type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

export function SessionWorkspace({ sessionId }: { sessionId: string }) {
  const initializeSession = useSessionStore((state) => state.initializeSession);
  const session = useSessionStore((state) => state.session);
  const lastMutation = useSessionStore((state) => state.lastMutation);
  const setSession = useSessionStore((state) => state.setSession);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);

  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isGroupSession, setIsGroupSession] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [collaborationName, setCollaborationName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hasHydratedRef = useRef(false);

  useSessionRealtime(sessionId);
  const { count: onlineCount, peers } = useOnlineMembers(
    sessionId,
    selectedTarget,
    collaborationName,
    isGroupSession && Boolean(collaborationName.trim())
  );

  const persistMutation = useCallback(async (patch: SessionPatch) => {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/sessions/${patch.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });

      if (response.status === 409) {
        const data = (await response.json()) as { session?: SessionModel };
        if (data.session) setSession(data.session);
        setSaveState("conflict");
        return;
      }

      if (!response.ok) throw new Error("Failed to save session");
      setSaveState("saved");
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  }, [setSession]);

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load session");

        const data = (await response.json()) as {
          session?: SessionModel;
          isGroup?: boolean;
          participant?: { id: string; name: string } | null;
        };
        const nextSession = data.session ?? mockSession(sessionId);

        if (!isActive) return;
        const nextIsGroupSession = Boolean(data.isGroup);
        setIsGroupSession(nextIsGroupSession);
        if (nextIsGroupSession) {
          const savedName =
            data.participant?.name ??
            window.localStorage.getItem(`ap-group-display-name:${sessionId}`) ??
            "";
          setCollaborationName(savedName);
          setDisplayNameInput(savedName);
        }
        initializeSession(nextSession);
        hasHydratedRef.current = true;
      } catch (error) {
        console.error(error);
        if (!isActive) return;
        initializeSession(mockSession(sessionId));
        hasHydratedRef.current = true;
        setLoadFailed(true);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadSession();
    return () => {
      isActive = false;
    };
  }, [initializeSession, sessionId]);

  useEffect(() => {
    if (!lastMutation || !session || !hasHydratedRef.current || isLoading) return;

    const timer = window.setTimeout(() => {
      void persistMutation(lastMutation);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isLoading, lastMutation, persistMutation, session]);

  const saveStatusLabel =
    loadFailed ? "読み込み失敗（オフラインモード）"
    : saveState === "saving" ? "保存中..."
    : saveState === "saved" ? "保存済み"
    : saveState === "conflict" ? "最新に同期しました"
    : saveState === "error" ? "保存失敗 — サーバーに接続できません"
    : "";

  const handleDisplayNameSubmit = () => {
    const nextName = displayNameInput.trim() || "参加者";
    window.localStorage.setItem(`ap-group-display-name:${sessionId}`, nextName);
    setCollaborationName(nextName);
  };

  if (isLoading) {
    return <div className="page-container">Loading session...</div>;
  }

  return (
    <div className="workspace-page">
      <div className="workspace-topbar">
        <div>
          <h1 className="workspace-title">メインエディタ</h1>
        </div>

        <div className="horizontal-actions">
          {onlineCount > 1 && (
            <span className="online-badge">
              {onlineCount} online
            </span>
          )}
          {saveStatusLabel && (
            <span className={`save-status ${loadFailed ? "save-status-error" : `save-status-${saveState}`}`}>
              {saveStatusLabel}
            </span>
          )}
          <Link href={`/session/${sessionId}/story`} className="button-primary">
            <BookOpenText size={16} />
            <span className="icon-tooltip">小説を生成</span>
          </Link>
        </div>
      </div>

      <div className="workspace-layout">
        <div className="workspace-main">
          <CenterGraph collaborationPeers={peers} />
        </div>
        <div className="workspace-bottom">
          <LeftPanel collaborationPeers={peers} />
          <RightPanel collaborationPeers={peers} />
        </div>
      </div>

      {isGroupSession && !collaborationName.trim() && (
        <div className="modal-overlay">
          <div className="modal-card collaboration-name-modal">
            <div className="modal-header">
              <h2 className="modal-title">表示名を入力</h2>
            </div>
            <p className="collaboration-name-note">
              グループ編集で、どのAP項目を見ているかを他の参加者に伝えるための名前です。
            </p>
            <div className="invite-modal-form">
              <input
                className="login-input"
                value={displayNameInput}
                onChange={(event) => setDisplayNameInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleDisplayNameSubmit();
                }}
                placeholder="例：佐藤、A班 山田"
                autoFocus
              />
              <button type="button" className="button-primary" onClick={handleDisplayNameSubmit}>
                参加する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
