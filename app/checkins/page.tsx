"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { pick, useLanguage } from "@/app/useLanguage";

type Checkin = {
  id: string;
  checked_in_at: string;
  method: string;
  participants: { name: string; email: string | null } | null;
};

const copy = {
  ko: {
    title: "오늘의 참여명단",
    challengeLabel: "챌린지 이름",
    loadingChallenges: "챌린지 목록 불러오는 중...",
    noChallenges: "등록된 챌린지가 없습니다",
    loading: "불러오는 중...",
    load: "참여명단 불러오기",
    date: "날짜",
    unknownMember: "알 수 없는 멤버",
    noEmail: "이메일 없음",
    empty: "아직 참여자가 없습니다.",
    challengeLoadFailed: "챌린지 목록을 불러올 수 없습니다.",
    listLoadFailed: "참여명단을 불러올 수 없습니다.",
  },
  en: {
    title: "Today's Participant List",
    challengeLabel: "Challenge Name",
    loadingChallenges: "Loading challenges...",
    noChallenges: "No challenges found",
    loading: "Loading...",
    load: "Load Participant List",
    date: "Date",
    unknownMember: "Unknown member",
    noEmail: "No email",
    empty: "No participants yet.",
    challengeLoadFailed: "Could not load challenges.",
    listLoadFailed: "Could not load participant list.",
  },
} as const;

export default function CheckinsPage() {
  const { language } = useLanguage();
  const t = pick(language, copy);
  const [challenges, setChallenges] = useState<string[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [date, setDate] = useState("");
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [message, setMessage] = useState("");
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadChallenges() {
      try {
        const response = await fetch("/api/challenges", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? t.challengeLoadFailed);
        }

        const names = result.challenges as string[];
        setChallenges(names);
        setChallengeId(names[0] ?? "");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : t.challengeLoadFailed);
      } finally {
        setLoadingChallenges(false);
      }
    }

    void loadChallenges();
  }, [t.challengeLoadFailed]);

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
        throw new Error(result.error ?? t.listLoadFailed);
      }

      setDate(result.date);
      setCheckins(result.checkins);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.listLoadFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <h1>{t.title}</h1>
      <label>
        {t.challengeLabel}
        <select
          value={challengeId}
          onChange={(event) => {
            setChallengeId(event.target.value);
            setDate("");
            setCheckins([]);
          }}
          disabled={loadingChallenges || loading}
          style={styles.input}
        >
          {loadingChallenges && <option>{t.loadingChallenges}</option>}
          {!loadingChallenges && challenges.length === 0 && (
            <option value="">{t.noChallenges}</option>
          )}
          {challenges.map((challenge) => (
            <option key={challenge} value={challenge}>
              {challenge}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={loading || !challengeId}
        onClick={loadCheckins}
        style={styles.button}
      >
        {loading ? t.loading : t.load}
      </button>
      {date && (
        <p>
          {t.date}: {date}
        </p>
      )}
      {message && <p style={styles.error}>{message}</p>}
      <section style={styles.list}>
        {checkins.map((checkin) => (
          <article key={checkin.id} style={styles.item}>
            <strong>{checkin.participants?.name ?? t.unknownMember}</strong>
            <span>{checkin.participants?.email ?? t.noEmail}</span>
            <span>
              {new Date(checkin.checked_in_at).toLocaleTimeString(
                language === "ko" ? "ko-KR" : "en-US",
              )}
            </span>
          </article>
        ))}
        {!loading && date && checkins.length === 0 && <p>{t.empty}</p>}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    maxWidth: 760,
    margin: "40px auto",
    padding: 20,
    display: "grid",
    gap: 20,
  },
  input: {
    display: "block",
    width: "100%",
    marginTop: 6,
    padding: 10,
    border: "1px solid #bbb",
    borderRadius: 6,
    background: "#fff",
  },
  button: {
    padding: 12,
    border: 0,
    borderRadius: 6,
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  },
  list: { display: "grid", gap: 10 },
  item: {
    display: "grid",
    gridTemplateColumns: "2fr 2fr 1fr",
    gap: 12,
    padding: 16,
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fff",
    color: "#111",
  },
  error: { color: "#b42318", margin: 0 },
};
