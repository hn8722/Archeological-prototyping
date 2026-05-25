"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SessionList } from "./SessionList";
import { GalleryTab } from "./GalleryTab";
import { GroupTab } from "./GroupTab";

type SessionSummary = {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

type Tab = "user" | "gallery" | "group";

const TABS: { id: Tab; label: string }[] = [
  { id: "user", label: "ユーザー" },
  { id: "gallery", label: "ギャラリー" },
  { id: "group", label: "グループ" },
];

export function HomeClient({ initialSessions }: { initialSessions: SessionSummary[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("user");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sessionName.trim() || undefined }),
      });
      if (!response.ok) throw new Error("Failed to create session");
      const data = (await response.json()) as { session: { id: string } };
      router.refresh();
      router.push(`/session/${data.session.id}`);
    } catch (error) {
      console.error(error);
      alert("セッション作成に失敗しました。");
      setIsCreating(false);
    }
  };

  return (
    <div className="home-container">
      <div className="home-history-section">
        {/* タブ */}
        <div className="home-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`home-tab ${activeTab === tab.id ? "home-tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="home-tab-content">
          {activeTab === "user" && (
            <>
              {/* 新規セッション作成（ユーザータブ内） */}
              <div className="group-create-area">
                {!showCreateForm ? (
                  <button
                    className="group-create-btn"
                    onClick={() => setShowCreateForm(true)}
                  >
                    + 新規セッションを作成
                  </button>
                ) : (
                  <div className="group-create-form">
                    <input
                      className="home-new-input"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !isCreating) void handleCreate(); }}
                      placeholder="セッション名（任意）"
                      disabled={isCreating}
                      autoFocus
                    />
                    <button
                      className="button-primary"
                      onClick={() => void handleCreate()}
                      disabled={isCreating}
                    >
                      {isCreating ? "作成中..." : "作成して開始"}
                    </button>
                    <button
                      className="group-create-cancel"
                      onClick={() => { setShowCreateForm(false); setSessionName(""); }}
                      disabled={isCreating}
                    >
                      キャンセル
                    </button>
                  </div>
                )}
              </div>
              <SessionList initialSessions={initialSessions} />
            </>
          )}
          {activeTab === "gallery" && <GalleryTab userSessions={initialSessions} />}
          {activeTab === "group" && <GroupTab />}
        </div>
      </div>
    </div>
  );
}
