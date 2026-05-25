"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";

type LoginState = { error?: string } | null;

export default function LoginPage() {
  const [state, formAction] = useActionState<LoginState, FormData>(
    async (_prev, formData) => {
      const result = await login(formData);
      return result ?? null;
    },
    null
  );

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">AP</div>
        <h1 className="login-title">Archeological Prototyping</h1>
        <p className="login-subtitle">続けるにはログインしてください</p>

        <form className="login-form" action={formAction}>
          {state?.error && (
            <p className="login-error">{state.error}</p>
          )}

          <div className="login-field">
            <label className="login-label" htmlFor="email">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="login-input"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="password">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="login-input"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-button">
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}
