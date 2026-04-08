"use client";

import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { NodeEntry, EdgeEntry } from "@/lib/types/ap";

export function RightPanel() {
  const session = useSessionStore((state) => state.session);
  const selectedTarget = useSessionStore((state) => state.selectedTarget);
  const updateNodeText = useSessionStore((state) => state.updateNodeText);
  const updateEdgeText = useSessionStore((state) => state.updateEdgeText);

  const selectedEntry = useMemo((): NodeEntry | EdgeEntry | null => {
    if (!session || !selectedTarget) return null;

    const generation = session.generations.find(
      (g) => g.generationIndex === selectedTarget.generation
    );
    if (!generation) return null;

    if (selectedTarget.kind === "node") {
      return generation.nodes[selectedTarget.id] ?? null;
    }

    return generation.edges[selectedTarget.id] ?? null;
  }, [session, selectedTarget]);

  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (selectedEntry?.text) {
      setInputValue(selectedEntry.text);
    } else {
      setInputValue("");
    }
  }, [selectedEntry]);

  const handleConfirm = () => {
    if (!selectedTarget) return;

    if (selectedTarget.kind === "node") {
      updateNodeText(selectedTarget.generation, selectedTarget.id, inputValue);
      return;
    }

    updateEdgeText(selectedTarget.generation, selectedTarget.id, inputValue);
  };

  const isLocked = selectedEntry?.status === "locked";

  return (
    <aside className="panel">
      <h2 className="panel-title">右図: 入力スペース</h2>

      {!selectedTarget && <p>左または中央から対象を選択してください。</p>}

      {selectedTarget && selectedEntry && (
        <>
          <div className="selected-box">
            <p>
              <strong>対象種別:</strong> {selectedTarget.kind}
            </p>
            <p>
              <strong>世代:</strong> {selectedTarget.generation}
            </p>
            <p>
              <strong>ID:</strong> {selectedTarget.id}
            </p>
            <p>
              <strong>名前:</strong> {selectedEntry.label}
            </p>
            <p>
              <strong>状態:</strong> {selectedEntry.status}
            </p>

            {selectedTarget.kind === "edge" && (
              <p>
                <strong>接続:</strong> {(selectedEntry as EdgeEntry).source} →{" "}
                {(selectedEntry as EdgeEntry).target}
              </p>
            )}
          </div>

          <label className="form-label">入力欄</label>
          <textarea
            className="form-textarea"
            value={inputValue}
            disabled={isLocked}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isLocked ? "この要素は現在ロックされています" : "ここに内容を入力"
            }
          />

          <div className="sub-box">
            <p>
              <strong>影響するモデル:</strong>
            </p>
            <p>前後1世代の関連要素をここに表示する拡張が可能です。</p>
          </div>

          <div className="vertical-actions">
            <button
              className="button-primary"
              onClick={handleConfirm}
              disabled={isLocked}
            >
              入力決定
            </button>
            <button className="button-secondary" disabled={isLocked}>
              修正
            </button>
            <button className="button-secondary">AIアシスト</button>
          </div>
        </>
      )}
    </aside>
  );
}