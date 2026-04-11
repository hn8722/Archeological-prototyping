"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewSessionPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleStart = async () => {
    setIsCreating(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: sessionName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data = (await response.json()) as {
        session: { id: string };
      };

      router.push(`/session/${data.session.id}`);
    } catch (error) {
      console.error(error);
      alert("セッション作成に失敗しました。");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">新規セッション作成</h1>

      <div className="form-card">
        <label className="form-label">セッション名</label>
        <input
          className="form-input"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="例: 未来の公共交通ワークショップ"
        />

        <div className="form-actions">
          <button className="button-primary" onClick={handleStart} disabled={isCreating}>
            {isCreating ? "作成中..." : "開始する"}
          </button>
        </div>
      </div>
    </div>
  );
}
