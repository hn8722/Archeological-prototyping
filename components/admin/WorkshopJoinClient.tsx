"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function WorkshopJoinClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (!code.trim()) return;
    setIsJoining(true);
    setError(null);
    try {
      const response = await fetch("/api/group/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) {
        throw new Error(data.error ?? "参加できませんでした。");
      }
      router.push(`/session/${data.sessionId}`);
    } catch (joinError) {
      console.error(joinError);
      setError(joinError instanceof Error ? joinError.message : "参加できませんでした。");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="workshop-join-page">
      <section className="workshop-join-card">
        <p className="admin-eyebrow">Workshop Join</p>
        <h1>ワークショップに参加</h1>
        <p>管理者から共有された参加コードを入力してください。</p>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !isJoining) void join();
          }}
          placeholder="参加コード"
          autoFocus
        />
        <button type="button" onClick={() => void join()} disabled={isJoining || !code.trim()}>
          {isJoining ? "参加中..." : "参加する"}
        </button>
        {error && <p className="admin-error">{error}</p>}
      </section>
    </div>
  );
}
