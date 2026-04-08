import Link from "next/link";

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="app-logo">
          AP Story App
        </Link>
      </div>
    </header>
  );
}