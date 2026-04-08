"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewSessionPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");

  const handleStart = () => {
    const id = "demo-session";
    router.push(`/session/${id}`);
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
          placeholder="例: 物語生成実験01"
        />

        <label className="form-label">テンプレート</label>
        <select className="form-input" defaultValue="default-ap">
          <option value="default-ap">Default AP Template</option>
        </select>

        <button className="button-primary" onClick={handleStart}>
          開始する
        </button>
      </div>
    </div>
  );
}