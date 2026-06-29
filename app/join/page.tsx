"use client";

import { FormEvent, useState } from "react";
import type { CSSProperties } from "react";

type FormState = {
  name: string;
  role: string;
  team: string;
  memo: string;
  gender: string;
  email: string;
  kakao: string;
  phone: string;
  instagram: string;
  joinDate: string;
  grade: string;
};

const initialForm: FormState = {
  name: "",
  role: "",
  team: "",
  memo: "",
  gender: "",
  email: "",
  kakao: "",
  phone: "",
  instagram: "",
  joinDate: "",
  grade: "",
};

export default function JoinPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "가입 신청에 실패했습니다.");
      }

      const prefix =
        result.status === "already_registered"
          ? "이미 등록된 멤버라 기존 QR 코드를 다시 보냈습니다."
          : "가입 신청이 완료되었습니다.";

      setMessage(
        result.emailSent
          ? `${prefix} 이메일에서 QR 코드를 확인해주세요.`
          : `${prefix} 다만 이메일 발송은 실패했습니다: ${result.emailError}`,
      );

      if (result.status === "registered") {
        setForm(initialForm);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "가입 신청에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>PIC 가입 신청</p>
        <h1 style={styles.title}>가입 정보를 입력해주세요</h1>
        <p style={styles.description}>
          제출하면 멤버 명단에 등록되고, 입력한 이메일로 개인 QR 코드가 바로
          발송됩니다.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            이름 *
            <input
              required
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              style={styles.input}
              placeholder="홍길동"
            />
          </label>

          <label style={styles.label}>
            직책
            <input
              value={form.role}
              onChange={(event) => updateField("role", event.target.value)}
              style={styles.input}
              placeholder="예: 회장, 부원"
            />
          </label>

          <label style={styles.label}>
            팀
            <input
              value={form.team}
              onChange={(event) => updateField("team", event.target.value)}
              style={styles.input}
              placeholder="예: 기획팀"
            />
          </label>

          <label style={styles.label}>
            메모
            <textarea
              value={form.memo}
              onChange={(event) => updateField("memo", event.target.value)}
              style={{ ...styles.input, minHeight: 92, resize: "vertical" }}
              placeholder="추가로 남길 내용"
            />
          </label>

          <label style={styles.label}>
            젠더
            <select
              value={form.gender}
              onChange={(event) => updateField("gender", event.target.value)}
              style={styles.input}
            >
              <option value="">선택 안 함</option>
              <option value="남성">남성</option>
              <option value="여성">여성</option>
              <option value="기타">기타</option>
            </select>
          </label>

          <label style={styles.label}>
            이메일 *
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              style={styles.input}
              placeholder="name@example.com"
            />
          </label>

          <label style={styles.label}>
            카카오톡
            <input
              value={form.kakao}
              onChange={(event) => updateField("kakao", event.target.value)}
              style={styles.input}
              placeholder="카카오톡 ID"
            />
          </label>

          <label style={styles.label}>
            번호
            <input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              style={styles.input}
              placeholder="010-0000-0000"
            />
          </label>

          <label style={styles.label}>
            인스타
            <input
              value={form.instagram}
              onChange={(event) => updateField("instagram", event.target.value)}
              style={styles.input}
              placeholder="@pic"
            />
          </label>

          <label style={styles.label}>
            입사일
            <input
              type="date"
              value={form.joinDate}
              onChange={(event) => updateField("joinDate", event.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            학년
            <select
              value={form.grade}
              onChange={(event) => updateField("grade", event.target.value)}
              style={styles.input}
            >
              <option value="">선택 안 함</option>
              <option value="1학년">1학년</option>
              <option value="2학년">2학년</option>
              <option value="3학년">3학년</option>
              <option value="4학년">4학년</option>
              <option value="졸업생">졸업생</option>
            </select>
          </label>

          <button disabled={loading} type="submit" style={styles.button}>
            {loading ? "제출 중..." : "가입 신청하고 QR 받기"}
          </button>
        </form>

        {message ? <p style={styles.success}>{message}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "#f4f7fb",
    color: "#172033",
    padding: "40px 16px",
  },
  card: {
    width: "100%",
    maxWidth: 720,
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
  title: {
    margin: "8px 0",
    fontSize: 32,
    lineHeight: 1.2,
  },
  description: {
    margin: "0 0 28px",
    color: "#64748b",
    lineHeight: 1.6,
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  label: {
    display: "grid",
    gap: 7,
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
    gridColumn: "1 / -1",
    border: 0,
    borderRadius: 12,
    padding: "14px 16px",
    background: "#111827",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
  },
  success: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    background: "#dcfce7",
    color: "#166534",
    lineHeight: 1.5,
  },
  error: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    background: "#fee2e2",
    color: "#991b1b",
    lineHeight: 1.5,
  },
};
