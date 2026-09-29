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

type CachedSession = {
  savedAt: number;
  session: SessionModel;
};

function getSessionCacheKey(sessionId: string) {
  return `ap-session-cache:${sessionId}`;
}

function readCachedSession(sessionId: string): CachedSession | null {
  try {
    const raw = window.localStorage.getItem(getSessionCacheKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (parsed.session?.id !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedSession(session: SessionModel) {
  try {
    window.localStorage.setItem(
      getSessionCacheKey(session.id),
      JSON.stringify({ savedAt: Date.now(), session } satisfies CachedSession)
    );
  } catch {
    // localStorage can fail in private mode or when quota is exceeded.
  }
}

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
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasHydratedRef = useRef(false);
  const restoredLocalSessionRef = useRef<SessionModel | null>(null);
  const persistedMutationIdRef = useRef<string | null>(null);
  const persistingMutationIdRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const toastTimeoutRef = useRef<number | null>(null);

  const realtimeConnectionState = useSessionRealtime(sessionId, isGroupSession);
  const { count: onlineCount, peers, connectionState: presenceConnectionState } = useOnlineMembers(
    sessionId,
    selectedTarget,
    collaborationName,
    isGroupSession && Boolean(collaborationName.trim())
  );

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3500);
  }, []);

  const persistMutation = useCallback(async (patch: SessionPatch) => {
    if (persistingMutationIdRef.current === patch.mutationId) return;
    persistingMutationIdRef.current = patch.mutationId;
    setSaveState("saving");
    try {
      const response = await fetch(`/api/sessions/${patch.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });

      if (response.status === 409) {
        const data = (await response.json()) as { session?: SessionModel };
        const currentSession = useSessionStore.getState().session;
        if (data.session && (!currentSession || currentSession.revision <= data.session.revision)) {
          setSession(data.session);
        }
        persistedMutationIdRef.current = patch.mutationId;
        setSaveState("conflict");
        return;
      }

      const data = (await response.json().catch(() => ({}))) as { session?: SessionModel; error?: string };
      if (!response.ok) throw new Error(data.error ?? "セッションの保存に失敗しました。");
      const currentSession = useSessionStore.getState().session;
      if (data.session && (!currentSession || currentSession.revision <= data.session.revision)) {
        setSession(data.session);
      }
      persistedMutationIdRef.current = patch.mutationId;
      setSaveState("saved");
    } catch (error) {
      console.error(error);
      setSaveState("error");
    } finally {
      persistingMutationIdRef.current = null;
    }
  }, [setSession]);

  const persistFullSession = useCallback(async (sessionToPersist: SessionModel) => {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/sessions/${sessionToPersist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: sessionToPersist }),
      });

      if (!response.ok) throw new Error("Failed to save cached session");
      setSaveState("saved");
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  }, []);

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
        const serverSession = data.session ?? mockSession(sessionId);
        const cached = readCachedSession(sessionId);
        const nextSession =
          cached && cached.session.revision >= serverSession.revision
            ? cached.session
            : serverSession;

        if (!isActive) return;
        restoredLocalSessionRef.current =
          cached && cached.session.revision > serverSession.revision ? cached.session : null;
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
        if (restoredLocalSessionRef.current) {
          void persistFullSession(restoredLocalSessionRef.current);
        }
      } catch (error) {
        console.error(error);
        if (!isActive) return;
        const cached = readCachedSession(sessionId);
        const fallbackSession = cached?.session ?? mockSession(sessionId);
        restoredLocalSessionRef.current = cached?.session ?? null;
        initializeSession(fallbackSession);
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
  }, [initializeSession, persistFullSession, sessionId]);

  const syncWithServer = useCallback(async () => {
    if (syncingRef.current) return;
    const currentMutation = useSessionStore.getState().lastMutation;
    if (currentMutation && persistedMutationIdRef.current !== currentMutation.mutationId) return;

    syncingRef.current = true;
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { session?: SessionModel };
      const currentSession = useSessionStore.getState().session;
      if (response.ok && data.session && (!currentSession || data.session.revision >= currentSession.revision)) {
        setSession(data.session);
      }
    } catch (error) {
      console.error("Failed to reconcile group session", error);
    } finally {
      syncingRef.current = false;
    }
  }, [sessionId, setSession]);

  useEffect(() => {
    if (!session || !hasHydratedRef.current) return;
    writeCachedSession(session);
  }, [session]);

  useEffect(() => {
    if (!lastMutation || !session || !hasHydratedRef.current || isLoading) return;

    if (
      persistedMutationIdRef.current === lastMutation.mutationId ||
      persistingMutationIdRef.current === lastMutation.mutationId
    ) return;

    const timer = window.setTimeout(() => {
      void persistMutation(lastMutation);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isLoading, lastMutation, persistMutation, session]);

  useEffect(() => {
    if (!isGroupSession || isLoading) return;

    const handleFocus = () => void syncWithServer();
    const interval = window.setInterval(() => void syncWithServer(), 8_000);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isGroupSession, isLoading, syncWithServer]);

  useEffect(() => () => {
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
  }, []);

  const saveStatusLabel =
    loadFailed ? "読み込み失敗（オフラインモード）"
    : saveState === "saving" ? "保存中..."
    : saveState === "saved" ? "保存済み"
    : saveState === "conflict" ? "最新に同期しました"
    : saveState === "error" ? "保存失敗 — サーバーに接続できません"
    : "";

  const handleDisplayNameSubmit = async () => {
    const nextName = displayNameInput.trim() || "参加者";
    setIsSavingDisplayName(true);
    setDisplayNameError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/display-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nextName }),
      });
      const data = (await response.json().catch(() => ({}))) as { displayName?: string; error?: string };
      if (!response.ok || !data.displayName) {
        throw new Error(data.error ?? "表示名を保存できませんでした。");
      }
      window.localStorage.setItem(`ap-group-display-name:${sessionId}`, data.displayName);
      setCollaborationName(data.displayName);
      showToast("表示名を設定しました。");
    } catch (error) {
      console.error(error);
      setDisplayNameError(error instanceof Error ? error.message : "表示名を保存できませんでした。");
    } finally {
      setIsSavingDisplayName(false);
    }
  };

  const collaborationStatus =
    presenceConnectionState === "connected" && realtimeConnectionState === "connected"
      ? null
      : presenceConnectionState === "error" || realtimeConnectionState === "error"
        ? "共同編集に接続できません。再接続を試みています。"
        : "共同編集に接続中です…";

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
          {isGroupSession && peers.length > 0 && (
            <span
              className="collaboration-roster"
              title={peers.map((peer) => peer.displayName).join("、")}
            >
              参加中: {peers.slice(0, 3).map((peer) => peer.displayName).join("、")}
              {peers.length > 3 ? ` ほか${peers.length - 3}人` : ""}
            </span>
          )}
          {isGroupSession && collaborationStatus && (
            <span className="collaboration-status" role="status">{collaborationStatus}</span>
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
          <LeftPanel sessionId={sessionId} collaborationPeers={peers} />
          <RightPanel
            sessionId={sessionId}
            collaborationPeers={peers}
            authorName={collaborationName}
            onEntryCommitted={(action) => showToast(action === "added" ? "追加しました。保存中です…" : "更新しました。保存中です…")}
          />
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
                  if (event.key === "Enter" && !isSavingDisplayName) void handleDisplayNameSubmit();
                }}
                placeholder="例：佐藤、A班 山田"
                autoFocus
              />
              <button type="button" className="button-primary" onClick={() => void handleDisplayNameSubmit()} disabled={isSavingDisplayName}>
                {isSavingDisplayName ? "保存中…" : "参加する"}
              </button>
            </div>
            {displayNameError && <p className="invite-modal-error">{displayNameError}</p>}
          </div>
        </div>
      )}
      {toastMessage && <div className="workspace-toast" role="status">{toastMessage}</div>}
    </div>
  );
}
