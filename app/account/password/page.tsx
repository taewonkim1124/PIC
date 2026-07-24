"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (nextPassword !== confirmPassword) {
      setMessage("새 비밀번호가 서로 다릅니다.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "비밀번호를 변경하지 못했습니다.");

      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setMessage("비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>PIC Admin</p>
        <h1 style={styles.title}>비밀번호 변경</h1>
        <p style={styles.description}>
          회장에게 받은 임시 비밀번호로 로그인한 뒤, 본인만 아는 비밀번호로 변경하세요.
        </p>

        <form onSubmit={changePassword} style={styles.form}>
          <label style={styles.label}>
            현재 비밀번호
            <input
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            새 비밀번호
            <input
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              type="password"
              placeholder="8자 이상"
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            새 비밀번호 확인
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              style={styles.input}
            />
          </label>
          <button
            disabled={
              loading ||
              !currentPassword ||
              nextPassword.length < 8 ||
              nextPassword !== confirmPassword
            }
            style={styles.button}
          >
            {loading ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>

        {message && <p style={styles.notice}>{message}</p>}
      </section>
    </main>
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
    maxWidth: 460,
    margin: "0 auto",
    padding: 24,
    borderRadius: 18,
    background: "#fff",
    boxShadow: "0 12px 36px rgba(15, 23, 42, 0.08)",
  },
  eyebrow: { margin: 0, color: "#0369a1", fontSize: 13, fontWeight: 800 },
  title: { margin: "8px 0", fontSize: 32 },
  description: { margin: "0 0 24px", color: "#64748b", lineHeight: 1.6 },
  form: { display: "grid", gap: 14 },
  label: { display: "grid", gap: 7, fontWeight: 800 },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "12px 13px",
    fontSize: 15,
  },
  button: {
    border: 0,
    borderRadius: 12,
    padding: "14px 16px",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
  },
  notice: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    background: "#e0f2fe",
    color: "#075985",
  },
};
