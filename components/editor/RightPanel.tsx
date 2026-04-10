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
  const [isEditingConfirmedEntry, setIsEditingConfirmedEntry] = useState(false);

  useEffect(() => {
    if (selectedEntry?.text) {
      setInputValue(selectedEntry.text);
    } else {
      setInputValue("");
    }

    setIsEditingConfirmedEntry(false);
  }, [selectedEntry]);

  const handleConfirm = () => {
    if (!selectedTarget) return;

    if (selectedTarget.kind === "node") {
      updateNodeText(selectedTarget.generation, selectedTarget.id, inputValue);
      setIsEditingConfirmedEntry(false);
      return;
    }

    updateEdgeText(selectedTarget.generation, selectedTarget.id, inputValue);
    setIsEditingConfirmedEntry(false);
  };

  const isLocked = selectedEntry?.status === "locked";
  const isConfirmed = selectedEntry?.isConfirmed ?? false;
  const canEdit = !isLocked && (!isConfirmed || isEditingConfirmedEntry);
  const inputLength = inputValue.trim().length;
  const canConfirm = canEdit && inputLength >= 30;
  const showEditor = !isConfirmed || isEditingConfirmedEntry;

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

          <div className={`editor-stage ${showEditor ? "editor-stage-open" : "editor-stage-closed"}`}>
            <label className="form-label">入力欄</label>
            <textarea
              className="form-textarea"
              value={inputValue}
              disabled={!canEdit}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isLocked
                  ? "この要素は現在ロックされています"
                  : isConfirmed && !isEditingConfirmedEntry
                  ? "入力決定済みです。修正を押すと再編集できます"
                  : "ここに内容を入力"
              }
            />
          </div>

          <p className={`input-guide ${canConfirm ? "input-guide-ready" : ""}`}>
            {isLocked
              ? "この要素はロック中のため入力を確定できません。"
              : isConfirmed && !isEditingConfirmedEntry
              ? "入力決定済みです。修正を押すと再編集できます。"
              : canConfirm
              ? `入力文字数: ${inputLength}文字。入力決定できます。`
              : `入力文字数: ${inputLength}文字。30文字以上で入力決定が有効になります。`}
          </p>

          {isConfirmed && !isEditingConfirmedEntry && (
            <div className="confirmed-preview">
              <div className="confirmed-preview-header">
                <span className="confirmed-checkmark" aria-hidden="true">
                  ✓
                </span>
                <p className="confirmed-preview-label">入力決定済み</p>
              </div>
              <p className="confirmed-preview-text">{selectedEntry?.text || "内容はありません"}</p>
            </div>
          )}

          <div className="sub-box">
            <p>
              <strong>影響するモデル:</strong>
            </p>
            <p>前後1世代の関連要素をここに表示する拡張が可能です。</p>
          </div>

          <div className="vertical-actions right-panel-actions">
            <button
              className={canConfirm ? "button-primary" : "button-secondary"}
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              {isEditingConfirmedEntry ? "再度入力決定" : isConfirmed ? "入力決定済み" : "入力決定"}
            </button>
            <button
              className="button-secondary"
              disabled={isLocked || !isConfirmed || isEditingConfirmedEntry}
              onClick={() => setIsEditingConfirmedEntry(true)}
            >
              修正
            </button>
            <button className="button-secondary">AIアシスト</button>
          </div>
        </>
      )}
    </aside>
  );
}
