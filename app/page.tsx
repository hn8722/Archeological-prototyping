import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page-container">
      <h1 className="page-title">AP Story App</h1>
      <p className="page-description">
        APモデルに基づいて、世代ごとのノード・エッジを記述し、小説生成まで行うアプリです。
      </p>

      <div className="card-list">
        <div className="card">
          <h2>新規セッション作成</h2>
          <p>新しい作業セッションを開始します。</p>
          <Link href="/session/new" className="button-primary">
            新規作成
          </Link>
        </div>

        <div className="card">
          <h2>既存セッションを開く</h2>
          <p>ダミーセッションを開いて編集画面を確認します。</p>
          <Link href="/session/demo-session" className="button-primary">
            デモを開く
          </Link>
        </div>
      </div>
    </div>
  );
}