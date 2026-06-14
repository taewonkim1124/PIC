"use client";

import { useEffect, useRef, useState } from "react";
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
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const handlingScan = useRef(false);

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
    if (!scanning) return;

    let cancelled = false;

    async function startScanner() {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false,
      );
      scannerRef.current = scanner;
      scanner.render(async (decodedText) => {
        if (handlingScan.current) return;
        handlingScan.current = true;
        await scanner.clear().catch(console.error);
        scannerRef.current = null;
        setScanning(false);

        try {
          const response = await fetch("/api/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uniqueCode: decodedText, challengeId }),
          });
          const data = (await response.json()) as CheckinResult;
          setResult(data);
        } catch {
          setResult({ error: "체크인 서버에 연결할 수 없습니다." });
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
  }, [challengeId, scanning]);

  function scanAgain() {
    handlingScan.current = false;
    setResult(null);
    setScanning(true);
  }

  return (
    <main style={styles.main}>
      <h1>QR 체크인</h1>
      <label>
        챌린지 이름
        <select
          value={challengeId}
          onChange={(event) => setChallengeId(event.target.value)}
          disabled={scanning || loadingChallenges}
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

      {!scanning && !result && (
        <button disabled={!challengeId} onClick={scanAgain} style={styles.button}>
          카메라 시작
        </button>
      )}

      {scanning && <div id="qr-reader" style={styles.reader} />}

      {result && (
        <section style={styles.result}>
          <h2>{result.participantName ?? "체크인 실패"}</h2>
          {result.date && <p>{result.date}</p>}
          <p>{result.message ?? result.error}</p>
          <button onClick={scanAgain} style={styles.button}>
            다시 스캔
          </button>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 680, margin: "40px auto", padding: 20, display: "grid", gap: 20 },
  input: { display: "block", width: "100%", marginTop: 6, padding: 10, border: "1px solid #bbb", borderRadius: 6, background: "#fff" },
  button: { padding: 12, border: 0, borderRadius: 6, background: "#111", color: "#fff", cursor: "pointer" },
  reader: { width: "100%", background: "#fff" },
  result: { border: "1px solid #ddd", borderRadius: 12, padding: 24, background: "#fff", color: "#111" },
  error: { color: "#b42318", margin: 0 },
};
