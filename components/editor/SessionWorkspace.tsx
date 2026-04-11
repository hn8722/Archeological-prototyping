"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LeftPanel } from "./LeftPanel";
import { CenterGraph } from "./CenterGraph";
import { RightPanel } from "./RightPanel";
import { useSessionStore } from "@/store/useSessionStore";
import { mockSession } from "@/lib/data/mockSession";
import { SessionModel } from "@/lib/types/ap";

type SaveState = "idle" | "saving" | "saved" | "error";

export function SessionWorkspace({ sessionId }: { sessionId: string }) {
  const initializeSession = useSessionStore((state) => state.initializeSession);
  const session = useSessionStore((state) => state.session);
  const activeGeneration = useSessionStore((state) => state.activeGeneration);

  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hasHydratedRef = useRef(false);

  const persistSession = useCallback(async (nextSession: SessionModel) => {
    setSaveState("saving");

    try {
      const response = await fetch(`/api/sessions/${nextSession.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session: nextSession }),
      });

      if (!response.ok) {
        throw new Error("Failed to save session");
      }

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
        const response = await fetch(`/api/sessions/${sessionId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load session");
        }

        const data = (await response.json()) as {
          session?: SessionModel;
        };

        const nextSession = data.session ?? mockSession(sessionId);

        if (!isActive) return;

        initializeSession(nextSession);
        hasHydratedRef.current = true;
      } catch (error) {
        console.error(error);

        if (!isActive) return;

        const fallback = mockSession(sessionId);
        initializeSession(fallback);
        hasHydratedRef.current = true;
        setSaveState("error");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      isActive = false;
    };
  }, [initializeSession, sessionId]);

  useEffect(() => {
    if (!session || !hasHydratedRef.current || isLoading) return;

    const timer = window.setTimeout(() => {
      void persistSession(session);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isLoading, persistSession, session]);

  const saveStatusLabel =
    saveState === "saving"
      ? "保存中..."
      : saveState === "saved"
      ? "保存済み"
      : saveState === "error"
      ? "保存失敗"
      : "自動保存";

  if (isLoading) {
    return <div className="page-container">セッションを読み込んでいます...</div>;
  }

  return (
    <div className="workspace-page">
      <div className="workspace-topbar">
        <div>
          <h1 className="workspace-title">メイン編集画面</h1>
        </div>

        <div className="horizontal-actions">
          <span className={`save-status save-status-${saveState}`}>{saveStatusLabel}</span>
          <Link href={`/session/${sessionId}/story`} className="button-primary">
            小説生成
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
