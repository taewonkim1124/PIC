"use client";

import { useState } from "react";

const DEFAULT_CHALLENGE_ID = "기본 챌린지";

type Checkin = {
  id: string;
  checked_in_at: string;
  method: string;
  participants: { name: string; email: string | null } | null;
};

export default function CheckinsPage() {
  const [challengeId, setChallengeId] = useState(DEFAULT_CHALLENGE_ID);
  const [date, setDate] = useState("");
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadCheckins() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/checkins/today?challengeId=${encodeURIComponent(challengeId)}`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "참여명단을 불러올 수 없습니다.");
      }

      setDate(result.date);
      setCheckins(result.checkins);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "참여명단을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <h1>오늘의 참여명단</h1>
      <label>
        챌린지 이름
        <input
          value={challengeId}
          onChange={(event) => setChallengeId(event.target.value)}
          placeholder="기본 챌린지"
          style={styles.input}
        />
      </label>
      <button disabled={loading || !challengeId.trim()} onClick={loadCheckins} style={styles.button}>
        {loading ? "새로고침 중..." : "새로고침"}
      </button>
      {date && <p>날짜: {date}</p>}
      {message && <p style={{ color: "#b42318" }}>{message}</p>}
      <section style={styles.list}>
        {checkins.map((checkin) => (
          <article key={checkin.id} style={styles.item}>
            <strong>{checkin.participants?.name ?? "알 수 없는 멤버"}</strong>
            <span>{checkin.participants?.email ?? "이메일 없음"}</span>
            <span>{new Date(checkin.checked_in_at).toLocaleTimeString()}</span>
          </article>
        ))}
        {!loading && date && checkins.length === 0 && <p>아직 참여자가 없습니다.</p>}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 760, margin: "40px auto", padding: 20, display: "grid", gap: 20 },
  input: { display: "block", width: "100%", marginTop: 6, padding: 10, border: "1px solid #bbb", borderRadius: 6 },
  button: { padding: 12, border: 0, borderRadius: 6, background: "#111", color: "#fff", cursor: "pointer" },
  list: { display: "grid", gap: 10 },
  item: { display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 12, padding: 16, border: "1px solid #ddd", borderRadius: 8, background: "#fff", color: "#111" },
};
