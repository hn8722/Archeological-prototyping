"use client";

import { useEffect } from "react";
import { LeftPanel } from "./LeftPanel";
import { CenterGraph } from "./CenterGraph";
import { RightPanel } from "./RightPanel";
import { useSessionStore } from "@/store/useSessionStore";
import { mockSession } from "@/lib/data/mockSession";
import Link from "next/link";

export function SessionWorkspace({ sessionId }: { sessionId: string }) {
  const initializeSession = useSessionStore((state) => state.initializeSession);
  const activeGeneration = useSessionStore((state) => state.activeGeneration);
  const setActiveGeneration = useSessionStore((state) => state.setActiveGeneration);

  useEffect(() => {
    initializeSession(mockSession(sessionId));
  }, [initializeSession, sessionId]);

  return (
    <div className="workspace-page">
      <div className="workspace-topbar">
        <div>
          <h1 className="workspace-title">メイン編集画面</h1>
          <p className="workspace-subtitle">
            表示中の中心世代: {activeGeneration}
          </p>
        </div>

        <div className="horizontal-actions">
          <button
            className="button-secondary"
            onClick={() => setActiveGeneration(Math.max(1, activeGeneration - 1))}
          >
            前の世代
          </button>
          <button
            className="button-secondary"
            onClick={() => setActiveGeneration(activeGeneration + 1)}
          >
            次の世代
          </button>
          <button className="button-secondary">保存</button>
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
