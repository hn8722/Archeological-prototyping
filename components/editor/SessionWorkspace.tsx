"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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

  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hasHydratedRef = useRef(false);

  useSessionRealtime(sessionId);
  const onlineCount = useOnlineMembers(sessionId);

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

        const data = (await response.json()) as { session?: SessionModel };
        const nextSession = data.session ?? mockSession(sessionId);

        if (!isActive) return;
        initializeSession(nextSession);
        hasHydratedRef.current = true;
      } catch (error) {
        console.error(error);
        if (!isActive) return;
        initializeSession(mockSession(sessionId));
        hasHydratedRef.current = true;
        setSaveState("error");
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
    saveState === "saving" ? "Saving..."
    : saveState === "saved" ? "Saved"
    : saveState === "conflict" ? "Synced newer changes"
    : saveState === "error" ? "Save failed"
    : "Idle";

  if (isLoading) {
    return <div className="page-container">Loading session...</div>;
  }

  return (
    <div className="workspace-page">
      <div className="workspace-topbar">
        <div>
          <h1 className="workspace-title">Main Editing Screen</h1>
        </div>

        <div className="horizontal-actions">
          {onlineCount > 1 && (
            <span className="online-badge">
              {onlineCount} online
            </span>
          )}
          <span className={`save-status save-status-${saveState}`}>{saveStatusLabel}</span>
          <Link href={`/session/${sessionId}/story`} className="button-primary">
            Generate Story
          </Link>
        </div>
      </div>

      <div className="workspace-layout">
        <div className="workspace-main">
          <CenterGraph />
        </div>
        <div className="workspace-bottom">
          <LeftPanel />
          <RightPanel />
        </div>
      </div>
    </div>
  );
}
