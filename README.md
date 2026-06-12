# Archeological Prototyping（AP）

社会変化のダイナミクスを構造的に可視化・記述するためのコラボレーションツールです。
考古学およびデザイン学の考え方を活用した「APモデル」に基づき、複数世代にわたる社会変化をグラフ形式でマッピングし、AIアシストで考察を深め、最終的に物語を小説として出力します。

---

## システムアーキテクチャ

```
Next.js (App Router)
├── app/               ルーティング・ページ定義
├── components/        UIコンポーネント
│   ├── editor/        メインエディタ（3ペイン構成）
│   ├── session/       セッション一覧・ギャラリー・グループ
│   ├── admin/         ワークショップ管理
│   └── layout/        ヘッダー等
├── lib/
│   ├── types/ap.ts    コアデータ型定義
│   ├── templates/     APモデルのテンプレート定義・フィールド仕様
│   ├── session/       パッチ適用ロジック
│   ├── server/        DB操作・権限チェック
│   ├── realtime/      Supabase Realtimeフック
│   └── utils/         ユーティリティ
├── store/             Zustandグローバルストア
└── prisma.config.ts   DB設定
```

---

## コアデータモデル（`lib/types/ap.ts`）

| 型 | 説明 |
|---|---|
| `SessionModel` | 1つのワークセッション全体。複数の `GenerationModel` を持つ |
| `GenerationModel` | 1世代分のAPマップ。ノードとエッジのエントリを保持 |
| `NodeEntry` | APモデルの要素（制度、ペルソナ等）の記述データ |
| `EdgeEntry` | APモデルの矢印（ビジネスエコシステム等）の記述データ |
| `SessionPatch` | 楽観的ロック用の差分更新オブジェクト |
| `SelectedTarget` | 現在選択中のノード／エッジの参照 |

---

## APモデルテンプレート（`lib/templates/apTemplate.ts`）

APモデルは 6つのノードと 12本のエッジ（通常8本＋世代間4本）で構成される固定グラフです。

### ノード
| ID | ラベル |
|---|---|
| n1 | 制度 |
| n2 | 日常の空間とユーザー体験 |
| n3 | 前衛的社会問題 |
| n4 | 社会の目標 |
| n5 | 技術や資源 |
| n6 | ペルソナ |

### エッジ（世代内）
ビジネスエコシステム / アート / メディア / コミュニティ化 / 組織化 / コミュニケーション / 標準化 / 文化芸術振興

### 世代間エッジ
パラダイム / 製品・サービス / 意味付け / 習慣化

---

## フロントエンド — エディタ（`components/editor/`）

エディタは3ペイン構成です。

| コンポーネント | 役割 |
|---|---|
| `SessionWorkspace.tsx` | セッションの読み込み・保存管理・リアルタイム同期の統括 |
| `LeftPanel.tsx` | APパーツ一覧（アコーディオン形式で記述一覧を表示、削除操作） |
| `CenterGraph.tsx` | APマップのSVG/HTML可視化、世代ナビゲーション |
| `RightPanel.tsx` | 選択中の要素への入力フォーム（テキスト／画像／動画）、AIアシスト |

### 保存フロー

```
ユーザー操作
  → Zustandストア（楽観的更新）
  → 700ms debounce
  → PATCH /api/sessions/[id]
  → Supabase Realtime broadcast
  → 他クライアントに反映
```

競合が発生した場合（HTTP 409）、サーバー側の最新 `revision` で自動解決します。

---

## 状態管理（`store/useSessionStore.ts`）

Zustand によるクライアント側グローバルストアです。`SessionPatch` による差分更新方式を採用しており、`revision` 番号で競合を検出します。

| アクション | 説明 |
|---|---|
| `initializeSession` / `setSession` | セッション初期化・更新 |
| `applyRemotePatch` | 他クライアントからのリアルタイム差分を適用 |
| `ensureGeneration` | 世代の追加 |
| `appendNodeFieldEntry` / `appendEdgeFieldEntry` | 記述の追加 |
| `setNodeFieldEntries` / `setEdgeFieldEntries` | 記述の上書き |
| `selectTarget` | 選択中の要素を変更（UIと世代表示を連動） |

---

## サーバーサイド（`lib/server/session-store.ts`）

Prisma 経由で PostgreSQL にアクセスするサービス層です。

| 関数 | 役割 |
|---|---|
| `canReadSession` / `canWriteSession` | 閲覧・編集権限チェック（通常ユーザー・グループメンバー・ワークショップ参加者の3者に対応） |
| `canManageSession` | オーナー限定の管理操作権限チェック |
| `applySessionPatchRecord` | DBへのパッチ適用（楽観的ロック） |
| `createWorkshopParticipantByCode` | ワークショップコードによる匿名参加者登録 |
| `importGallerySelectionsIntoSession` | ギャラリーからの記述インポート（append／replaceモード） |
| `buildWorkshopExport` | ワークショップ全データのJSON出力 |

### アクセス権限モデル

セッションには「個人セッション」と「グループセッション（ワークショップ）」の2種類があります。

```
個人セッション  → ownerId が一致するユーザーのみ読み書き可
グループセッション → GroupMember（ログインユーザー）または
                    WorkshopParticipant（匿名・コード参加者）が読み書き可
                    ただし closed 後は workshopAllowReadAfterClose フラグで閲覧可否が制御される
```

---

## リアルタイム機能（`lib/realtime/`）

Supabase Realtime を使用します。

| フック | 役割 |
|---|---|
| `useSessionRealtime` | セッション差分（`SessionPatch`）をブロードキャスト・受信 |
| `useOnlineMembers` | Presence 機能で「誰がどの要素を見ているか」をリアルタイム表示 |

---

## API ルート一覧（`app/api/`）

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/sessions` | GET / POST | セッション一覧取得・新規作成 |
| `/api/sessions/[id]` | GET / PUT / PATCH / DELETE | セッション取得・保存・差分更新・削除 |
| `/api/sessions/[id]/story` | GET / POST | 小説ドラフトの取得・保存 |
| `/api/sessions/[id]/publish` | POST | セッションの公開設定 |
| `/api/sessions/[id]/members` | GET / POST / DELETE | グループメンバー管理 |
| `/api/group/sessions` | GET / POST | グループセッション一覧・作成 |
| `/api/group/join` | POST | グループセッションへの参加 |
| `/api/workshop/join` | POST | ワークショップコードによる匿名参加 |
| `/api/admin/workshops` | GET | 管理者向けワークショップ一覧 |
| `/api/admin/workshops/[id]` | GET / PATCH | ワークショップ設定変更 |
| `/api/admin/workshops/[id]/code` | POST | 参加コード生成 |
| `/api/admin/workshops/[id]/stories` | GET | 提出済み小説一覧 |
| `/api/admin/workshops/[id]/export` | GET | ワークショップデータのJSON出力 |
| `/api/gallery` | GET | 公開セッション一覧 |
| `/api/gallery/story` | GET / POST | ギャラリー小説の取得・作成 |
| `/api/gallery/import` | POST | ギャラリーからの記述インポート |
| `/api/ai/assist` | POST | フィールド入力のAI提案 |
| `/api/ai/image-assist` | POST | 画像からのフィールド自動入力 |
| `/api/ai/image-generate` | POST | 入力内容の画像化（意図確認用） |
| `/api/ai/video-assist` | POST | 動画URLからのフィールド自動入力 |

---

## 主要な技術スタック

| 技術 | 用途 |
|---|---|
| Next.js 15 (App Router) | フルスタックフレームワーク |
| TypeScript | 型安全な開発 |
| Zustand | クライアント側状態管理 |
| Prisma | ORMおよびDBスキーマ管理 |
| PostgreSQL | メインデータベース |
| Supabase Realtime | リアルタイムコラボレーション（ブロードキャスト・Presence） |
| OpenAI API | AIアシスト・画像生成・解析 |
