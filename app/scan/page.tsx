"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Html5QrcodeScanner } from "html5-qrcode";

type CheckinResult = {
  status?: "checked_in" | "already_checked_in";
  participantName?: string;
  date?: string;
  message?: string;
  error?: string;
};

export default function ScanPage() {
  const [challenges, setChallenges] = useState<string[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [challengeError, setChallengeError] = useState("");
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const cooldownRef = useRef(false);
  const lastCodeRef = useRef("");
  const busyRef = useRef(false);

  useEffect(() => {
    async function loadChallenges() {
      try {
        const response = await fetch("/api/challenges", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        const names = data.challenges as string[];
        setChallenges(names);
        setChallengeId(names[0] ?? "");
      } catch (error) {
        setChallengeError(
          error instanceof Error
            ? error.message
            : "챌린지 목록을 불러올 수 없습니다.",
        );
      } finally {
        setLoadingChallenges(false);
      }
    }

    void loadChallenges();
  }, []);

  useEffect(() => {
    if (!running) return;

    let cancelled = false;

    async function startScanner() {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      if (cancelled || scannerRef.current) return;

      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false,
      );
      scannerRef.current = scanner;

      scanner.render(async (decodedText) => {
        const uniqueCode = decodedText.trim();
        if (!uniqueCode || cooldownRef.current || busyRef.current) return;

        cooldownRef.current = true;
        busyRef.current = true;
        lastCodeRef.current = uniqueCode;
        setBusy(true);
        setResult({ message: "체크인 저장 중..." });

        try {
          const response = await fetch("/api/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uniqueCode, challengeId }),
          });
          const data = (await response.json()) as CheckinResult;
          setResult(data);
        } catch {
          setResult({ error: "체크인 서버에 연결할 수 없습니다." });
        } finally {
          busyRef.current = false;
          setBusy(false);
          window.setTimeout(() => {
            cooldownRef.current = false;
          }, 1400);
        }
      }, undefined);
    }

    void startScanner();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) void scanner.clear().catch(() => undefined);
    };
  }, [challengeId, running]);

  function startContinuousScan() {
    setResult(null);
    setRunning(true);
    busyRef.current = false;
    cooldownRef.current = false;
    lastCodeRef.current = "";
  }

  function stopContinuousScan() {
    setRunning(false);
    setBusy(false);
    busyRef.current = false;
    cooldownRef.current = false;
    lastCodeRef.current = "";
    setResult(null);
  }

  const resultStyle =
    result?.error || result?.status === "already_checked_in"
      ? styles.warningResult
      : styles.successResult;

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>PIC 체크인</p>
        <h1 style={styles.title}>QR 연속 체크인</h1>
        <p style={styles.description}>
          카메라를 한 번 켜두면 QR을 스캔할 때마다 자동으로 체크인하고, 잠시
          후 다음 QR을 받을 준비를 합니다.
        </p>

        <label style={styles.label}>
          챌린지 이름
          <select
            value={challengeId}
            onChange={(event) => setChallengeId(event.target.value)}
            disabled={running || loadingChallenges}
            style={styles.input}
          >
            {loadingChallenges && <option>챌린지 목록 불러오는 중...</option>}
            {!loadingChallenges && challenges.length === 0 && (
              <option value="">등록된 챌린지가 없습니다</option>
            )}
            {challenges.map((challenge) => (
              <option key={challenge} value={challenge}>
                {challenge}
              </option>
            ))}
          </select>
        </label>

        {challengeError && <p style={styles.error}>{challengeError}</p>}

        {!running ? (
          <button
            disabled={!challengeId}
            onClick={startContinuousScan}
            style={styles.button}
          >
            연속 스캔 시작
          </button>
        ) : (
          <button onClick={stopContinuousScan} style={styles.secondaryButton}>
            연속 스캔 중지
          </button>
        )}

        {running && (
          <section style={styles.scannerWrap}>
            <div id="qr-reader" style={styles.reader} />
            <p style={styles.status}>
              {busy ? "저장 중..." : "다음 QR을 스캔할 준비가 됐습니다."}
            </p>
          </section>
        )}

        {result && (
          <section style={resultStyle}>
            <h2 style={styles.resultTitle}>
              {result.participantName ??
                (result.error ? "체크인 실패" : "체크인 처리 중")}
            </h2>
            {result.date && <p style={styles.resultText}>{result.date}</p>}
            <p style={styles.resultText}>{result.message ?? result.error}</p>
          </section>
        )}
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
  title: { margin: "8px 0", fontSize: 32, lineHeight: 1.2 },
  description: { margin: "0 0 24px", color: "#64748b", lineHeight: 1.6 },
  label: { display: "grid", gap: 7, fontSize: 14, fontWeight: 700 },
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
    marginTop: 18,
    border: 0,
    borderRadius: 12,
    padding: "14px 16px",
    background: "#111827",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    marginTop: 18,
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "14px 16px",
    background: "#ffffff",
    color: "#172033",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
  },
  scannerWrap: { marginTop: 18 },
  reader: { width: "100%", background: "#fff" },
  status: {
    margin: "12px 0 0",
    padding: 12,
    borderRadius: 10,
    background: "#e0f2fe",
    color: "#075985",
    textAlign: "center",
    fontWeight: 800,
  },
  successResult: {
    marginTop: 18,
    padding: 18,
    borderRadius: 14,
    background: "#dcfce7",
    color: "#166534",
  },
  warningResult: {
    marginTop: 18,
    padding: 18,
    borderRadius: 14,
    background: "#fef3c7",
    color: "#92400e",
  },
  resultTitle: { margin: "0 0 8px", fontSize: 22 },
  resultText: { margin: "0 0 8px", lineHeight: 1.5 },
  error: { color: "#b42318", margin: "12px 0 0" },
};
