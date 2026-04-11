"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSessionStore } from "@/store/useSessionStore";
import { SessionModel } from "@/lib/types/ap";

export default function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const sessionFromStore = useSessionStore((state) => state.session);
  const [session, setSession] = useState<SessionModel | null>(sessionFromStore);
  const [story, setStory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (sessionFromStore?.id === id) {
      setSession(sessionFromStore);
      return;
    }

    let isActive = true;

    const loadSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${id}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load session");
        }

        const data = (await response.json()) as { session?: SessionModel };
        if (isActive) {
          setSession(data.session ?? null);
        }
      } catch (error) {
        console.error(error);
        if (isActive) {
          setErrorMessage("セッションの読み込みに失敗しました。");
        }
      }
    };

    void loadSession();

    return () => {
      isActive = false;
    };
  }, [id, sessionFromStore]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      if (session) {
        const saveResponse = await fetch(`/api/sessions/${session.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ session }),
        });

        if (!saveResponse.ok) {
          throw new Error("Failed to save session before generating story");
        }
      }

      const response = await fetch(`/api/sessions/${id}/story`, {
        method: "POST",
      });

      const data = (await response.json()) as { story?: string; error?: string };

      if (!response.ok || !data.story) {
        throw new Error(data.error || "Failed to generate story");
      }

      setStory(data.story);
      setSaveMessage("生成された小説は自動保存されました。");
    } catch (error) {
      console.error(error);
      setErrorMessage("小説生成に失敗しました。OPENAI_API_KEY も確認してください。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">小説生成結果</h1>
      <p className="page-description">セッションID: {id}</p>
      <p className="page-description">セッション名: {session?.name ?? "未取得"}</p>

      <div className="story-box">
        {story ? <p>{story}</p> : <p>まだ小説は生成されていません。</p>}
      </div>

      {errorMessage && <p className="page-description">{errorMessage}</p>}
      {saveMessage && <p className="page-description">{saveMessage}</p>}

      <div className="horizontal-actions">
        <Link href={`/session/${id}`} className="button-secondary">
          編集画面へ戻る
        </Link>
        <button className="button-primary" onClick={handleGenerate} disabled={isGenerating || !session}>
          {isGenerating ? "生成中..." : "生成する"}
        </button>
      </div>
    </div>
  );
}
