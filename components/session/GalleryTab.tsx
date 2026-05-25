"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionModel } from "@/lib/types/ap";

type GallerySession = {
  id: string;
  name: string;
  ownerId: string | null;
  latestStory: string | null;
  createdAt: string;
  updatedAt: string;
  snapshot: string;
};

type SessionSummary = {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

type ModalMode = "detail" | "import";

type SelectableEntry = {
  key: string;
  targetKind: "node" | "edge";
  generationIndex: number;
  entryId: string;
  label: string;
  text: string;
};

type GeneratedStoryState = {
  story: string;
  model?: string;
  sourceSessions: { id: string; name: string }[];
};

function collectSelectableEntries(session: SessionModel): SelectableEntry[] {
  return session.generations.flatMap((generation) => {
    const nodes = Object.entries(generation.nodes)
      .filter(([, node]) => Boolean(node.text?.trim()))
      .map(([entryId, node]) => ({
        key: `node:${generation.generationIndex}:${entryId}`,
        targetKind: "node" as const,
        generationIndex: generation.generationIndex,
        entryId,
        label: node.label,
        text: node.text?.trim() || "",
      }));

    const edges = Object.entries(generation.edges)
      .filter(([, edge]) => Boolean(edge.text?.trim()))
      .map(([entryId, edge]) => ({
        key: `edge:${generation.generationIndex}:${entryId}`,
        targetKind: "edge" as const,
        generationIndex: generation.generationIndex,
        entryId,
        label: edge.label,
        text: edge.text?.trim() || "",
      }));

    return [...nodes, ...edges];
  });
}

export function GalleryTab({ userSessions }: { userSessions: SessionSummary[] }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<GallerySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStoryState, setGeneratedStoryState] = useState<GeneratedStoryState | null>(null);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [saveStoryName, setSaveStoryName] = useState("Gallery Story");
  const [isSavingStory, setIsSavingStory] = useState(false);

  const [modalSession, setModalSession] = useState<GallerySession | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("detail");
  const [selectedEntryKeys, setSelectedEntryKeys] = useState<Set<string>>(new Set());
  const [targetSessionId, setTargetSessionId] = useState(userSessions[0]?.id ?? "");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    fetch("/api/gallery?excludeSelf=true")
      .then((response) => response.json())
      .then((data: { sessions: GallerySession[] }) => setSessions(data.sessions))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!targetSessionId && userSessions[0]?.id) {
      setTargetSessionId(userSessions[0].id);
    }
  }, [targetSessionId, userSessions]);

  const modalEntries = useMemo(() => {
    if (!modalSession) return [];
    return collectSelectableEntries(JSON.parse(modalSession.snapshot) as SessionModel);
  }, [modalSession]);

  const selectedSessions = sessions.filter((session) => selectedIds.has(session.id));

  const toggleGallerySelection = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setGeneratedStoryState(null);
  };

  const openImportModal = (session: GallerySession) => {
    setModalSession(session);
    setModalMode("import");
    setSelectedEntryKeys(new Set());
    setTargetSessionId(userSessions[0]?.id ?? "");
    setImportMode("append");
  };

  const openDetailModal = (session: GallerySession) => {
    setModalSession(session);
    setModalMode("detail");
  };

  const closeModal = () => {
    setModalSession(null);
    setSelectedEntryKeys(new Set());
  };

  const toggleImportEntry = (key: string) => {
    setSelectedEntryKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleGenerateStory = async () => {
    if (selectedSessions.length === 0) return;

    setIsGenerating(true);
    setGeneratedStoryState(null);
    try {
      const response = await fetch("/api/gallery/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshots: selectedSessions.map((session) => session.snapshot) }),
      });
      if (!response.ok) throw new Error("Failed to generate story");

      const data = (await response.json()) as { story: string; model?: string };
      setGeneratedStoryState({
        story: data.story,
        model: data.model,
        sourceSessions: selectedSessions.map((session) => ({
          id: session.id,
          name: session.name,
        })),
      });
      setSaveStoryName(
        selectedSessions.length === 1
          ? `${selectedSessions[0].name} Story`
          : `${selectedSessions[0].name} + ${selectedSessions.length - 1} more`
      );
      setStoryModalOpen(true);
    } catch (error) {
      console.error(error);
      alert("Failed to generate a combined story.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGeneratedStory = async () => {
    if (!generatedStoryState) return;

    setIsSavingStory(true);
    try {
      const response = await fetch("/api/gallery/story/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveStoryName.trim() || "Gallery Story",
          story: generatedStoryState.story,
          model: generatedStoryState.model,
          sourceSessions: generatedStoryState.sourceSessions,
        }),
      });
      if (!response.ok) throw new Error("Failed to save generated story");

      const data = (await response.json()) as { session: { id: string } };
      router.push(`/session/${data.session.id}/story`);
    } catch (error) {
      console.error(error);
      alert("Failed to save the generated story.");
    } finally {
      setIsSavingStory(false);
    }
  };

  const handleImport = async () => {
    if (!modalSession || !targetSessionId || selectedEntryKeys.size === 0) return;

    const selections = modalEntries
      .filter((entry) => selectedEntryKeys.has(entry.key))
      .map((entry) => ({
        targetKind: entry.targetKind,
        generationIndex: entry.generationIndex,
        entryId: entry.entryId,
      }));

    setIsImporting(true);
    try {
      const response = await fetch("/api/gallery/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSessionId,
          sourceSessionId: modalSession.id,
          sourceSessionName: modalSession.name,
          sourceSnapshot: modalSession.snapshot,
          selections,
          mode: importMode,
        }),
      });
      if (!response.ok) throw new Error("Failed to import into existing project");

      router.push(`/session/${targetSessionId}`);
    } catch (error) {
      console.error(error);
      alert("Failed to import the selected entries.");
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) return <p className="home-placeholder">Loading gallery...</p>;
  if (sessions.length === 0) return <p className="home-placeholder">No public models are available yet.</p>;

  return (
    <>
      {selectedSessions.length > 0 && (
        <div className="gallery-action-bar">
          <span className="gallery-action-count">{selectedSessions.length} selected</span>
          <button
            className="button-primary"
            onClick={() => void handleGenerateStory()}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate Combined Story"}
          </button>
          <button
            className="gallery-action-clear"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      <div className="gallery-grid">
        {sessions.map((session) => {
          const isSelected = selectedIds.has(session.id);
          return (
            <div
              key={session.id}
              className={`gallery-card ${isSelected ? "gallery-card-selected" : ""}`}
              onClick={() => toggleGallerySelection(session.id)}
            >
              {isSelected && <div className="gallery-card-check">OK</div>}
              <div className="gallery-card-avatar">
                {session.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="gallery-card-body">
                <p className="gallery-card-name">{session.name}</p>
                {session.latestStory && (
                  <p className="gallery-card-preview">
                    {session.latestStory.slice(0, 80)}...
                  </p>
                )}
                <p className="gallery-card-meta">
                  Updated: {new Date(session.updatedAt).toLocaleDateString("ja-JP")}
                </p>
              </div>
              <div className="gallery-card-actions" onClick={(event) => event.stopPropagation()}>
                <button
                  className="gallery-card-action-btn"
                  onClick={() => openDetailModal(session)}
                >
                  Details
                </button>
                <button
                  className="gallery-card-action-btn"
                  onClick={() => openImportModal(session)}
                >
                  Import
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalSession && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card gallery-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{modalSession.name}</h2>
              <button className="modal-close" onClick={closeModal}>x</button>
            </div>

            {modalMode === "detail" && (
              <>
                <div className="modal-section">
                  <h3 className="modal-section-title">Latest Story</h3>
                  <p className="modal-story-text">
                    {modalSession.latestStory || "No generated story yet."}
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    className="gallery-modal-switch-btn"
                    onClick={() => setModalMode("import")}
                  >
                    Import into My Project
                  </button>
                </div>
              </>
            )}

            {modalMode === "import" && (
              <>
                <div className="modal-section">
                  <label className="modal-section-title" htmlFor="target-session">
                    Target Project
                  </label>
                  <select
                    id="target-session"
                    className="login-input"
                    value={targetSessionId}
                    onChange={(event) => setTargetSessionId(event.target.value)}
                    disabled={userSessions.length === 0}
                  >
                    {userSessions.length === 0 ? (
                      <option value="">Create a personal project first</option>
                    ) : (
                      userSessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="modal-section">
                  <h3 className="modal-section-title">Import Mode</h3>
                  <div className="gallery-import-mode">
                    <label>
                      <input
                        type="radio"
                        name="import-mode"
                        value="append"
                        checked={importMode === "append"}
                        onChange={() => setImportMode("append")}
                      />
                      Append
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="import-mode"
                        value="replace"
                        checked={importMode === "replace"}
                        onChange={() => setImportMode("replace")}
                      />
                      Replace
                    </label>
                  </div>
                </div>

                <div className="modal-section">
                  <h3 className="modal-section-title">Select Nodes and Edges</h3>
                  <div className="gallery-node-grid">
                    {modalEntries.map((entry) => {
                      const isSelected = selectedEntryKeys.has(entry.key);
                      return (
                        <button
                          key={entry.key}
                          className={`gallery-node-card ${isSelected ? "gallery-node-card-selected" : ""}`}
                          onClick={() => toggleImportEntry(entry.key)}
                        >
                          {isSelected && <span className="gallery-node-check">OK</span>}
                          <span className="gallery-node-label">
                            G{entry.generationIndex} / {entry.targetKind} / {entry.label}
                          </span>
                          <span className="gallery-node-text">{entry.text}</span>
                        </button>
                      );
                    })}
                    {modalEntries.length === 0 && (
                      <p className="modal-empty">This model has no reusable text entries yet.</p>
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    className="gallery-modal-switch-btn"
                    onClick={() => setModalMode("detail")}
                  >
                    Back
                  </button>
                  <button
                    className="button-primary"
                    onClick={() => void handleImport()}
                    disabled={!targetSessionId || isImporting || selectedEntryKeys.size === 0}
                  >
                    {isImporting ? "Importing..." : `Import ${selectedEntryKeys.size} entries`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {storyModalOpen && generatedStoryState && (
        <div className="modal-overlay" onClick={() => setStoryModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Combined Story</h2>
              <button className="modal-close" onClick={() => setStoryModalOpen(false)}>x</button>
            </div>
            <div className="modal-section">
              <p className="modal-story-text">{generatedStoryState.story}</p>
            </div>
            <div className="modal-section">
              <label className="modal-section-title" htmlFor="save-story-name">
                Save as Project
              </label>
              <input
                id="save-story-name"
                className="login-input"
                value={saveStoryName}
                onChange={(event) => setSaveStoryName(event.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button
                className="gallery-modal-switch-btn"
                onClick={() => setStoryModalOpen(false)}
              >
                Close
              </button>
              <button
                className="button-primary"
                onClick={() => void handleSaveGeneratedStory()}
                disabled={isSavingStory}
              >
                {isSavingStory ? "Saving..." : "Save to My Projects"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
