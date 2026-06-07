import Link from "next/link";
import { LogOut } from "lucide-react";
import { getUser, logout } from "@/lib/auth/actions";

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-label="Home">
      <path
        d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 18v-5h5v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatUserId(userId?: string) {
  if (!userId) return "";
  return `${userId.slice(0, 8)}...`;
}

export async function AppHeader() {
  const user = await getUser();

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="app-home-icon" aria-label="Go to home">
          <HomeIcon />
        </Link>
        {user && (
          <Link href="/admin/workshops" className="app-admin-link">
            Admin
          </Link>
        )}
        <div className="app-header-spacer" />
        {user && (
          <div className="app-user-chip" title={user.id}>
            <span className="app-user-email">{user.email ?? "unknown user"}</span>
            <span className="app-user-id">{formatUserId(user.id)}</span>
          </div>
        )}
        <form action={logout}>
          <button type="submit" className="app-logout-btn" aria-label="ログアウト">
            <LogOut size={16} />
            <span className="icon-tooltip">ログアウト</span>
          </button>
        </form>
      </div>
    </header>
  );
}
