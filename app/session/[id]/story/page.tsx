"use client";

import Link from "next/link";
import { useSessionStore } from "@/store/useSessionStore";

export default function StoryPage({
  params,
}: {
  params: { id: string };
}) {
  const session = useSessionStore((state) => state.session);

  const generatedStory = `
むかし、ある世代においてひとつの出来事が起こった。
その出来事は次の世代へと受け継がれ、やがて別の意味を持つようになった。
さらにその連鎖は、人の行動や認識、環境に影響を与え、ひとつの物語となった。
  `.trim();

  return (
    <div className="page-container">
      <h1 className="page-title">小説生成結果</h1>
      <p className="page-description">セッションID: {params.id}</p>
      <p className="page-description">セッション名: {session?.name ?? "未設定"}</p>

      <div className="story-box">
        <p>{generatedStory}</p>
      </div>

      <div className="horizontal-actions">
        <Link href={`/session/${params.id}`} className="button-secondary">
          編集画面へ戻る
        </Link>
        <button className="button-primary">再生成</button>
      </div>
    </div>
  );
}