"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { CSSProperties } from "react";

import { pick, useLanguage } from "@/app/useLanguage";

const savedUsernameKey = "pic-login-username";

const copy = {
  ko: {
    eyebrow: "PIC 보안",
    title: "로그인",
    description: "관리자 아이디와 비밀번호를 입력해 주세요.",
    username: "아이디",
    usernamePlaceholder: "admin",
    rememberUsername: "아이디 저장",
    password: "비밀번호",
    passwordPlaceholder: "비밀번호 입력",
    submit: "로그인",
    loading: "로그인 중...",
    failed: "로그인에 실패했습니다.",
  },
  en: {
    eyebrow: "PIC Security",
    title: "Log In",
    description: "Enter your admin username and password.",
    username: "Username",
    usernamePlaceholder: "admin",
    rememberUsername: "Remember username",
    password: "Password",
    passwordPlaceholder: "Enter password",
    submit: "Log In",
    loading: "Logging in...",
    failed: "Login failed.",
  },
} as const;

function LoginForm() {
  const { language } = useLanguage();
  const t = pick(language, copy);
  const searchParams = useSearchParams();
  const [username, setUsername] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(savedUsernameKey) ?? "";
  });
  const [rememberUsername, setRememberUsername] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem(savedUsernameKey));
  });
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? t.failed);
      }

      if (rememberUsername) {
        window.localStorage.setItem(savedUsernameKey, username.trim());
      } else {
        window.localStorage.removeItem(savedUsernameKey);
      }

      window.location.href = searchParams.get("next") || "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.failed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>{t.eyebrow}</p>
        <h1 style={styles.title}>{t.title}</h1>
        <p style={styles.description}>{t.description}</p>

        <form onSubmit={login} style={styles.form}>
          <label style={styles.label}>
            {t.username}
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder={t.usernamePlaceholder}
              style={styles.input}
            />
          </label>

          <label style={styles.checkboxLabel}>
            <input
              checked={rememberUsername}
              onChange={(event) => setRememberUsername(event.target.checked)}
              type="checkbox"
            />
            {t.rememberUsername}
          </label>

          <label style={styles.label}>
            {t.password}
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder={t.passwordPlaceholder}
              style={styles.input}
            />
          </label>

          <button disabled={loading || !username.trim() || !password} style={styles.button}>
            {loading ? t.loading : t.submit}
          </button>
        </form>

        {message && <p style={styles.error}>{message}</p>}
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "#f4f7fb",
    color: "#172033",
    padding: "56px 16px",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    margin: "0 auto",
    padding: 24,
    borderRadius: 18,
    background: "#ffffff",
    boxShadow: "0 12px 36px rgba(15, 23, 42, 0.08)",
  },
  eyebrow: {
    margin: 0,
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 1.5,
  },
  title: { margin: "8px 0", fontSize: 32, lineHeight: 1.2 },
  description: { margin: "0 0 24px", color: "#64748b", lineHeight: 1.6 },
  form: { display: "grid", gap: 14 },
  label: { display: "grid", gap: 7, fontSize: 14, fontWeight: 700 },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#475569",
    fontSize: 14,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "12px 13px",
    fontSize: 15,
    background: "#ffffff",
  },
  button: {
    width: "100%",
    border: 0,
    borderRadius: 12,
    padding: "14px 16px",
    background: "#111827",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    background: "#fee2e2",
    color: "#991b1b",
  },
};
