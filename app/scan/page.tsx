"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Html5Qrcode } from "html5-qrcode";

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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);
  const cooldownTimerRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

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
            : "챌린지 목록을 불러오지 못했습니다.",
        );
      } finally {
        setLoadingChallenges(false);
      }
    }

    void loadChallenges();

    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, []);

  async function stopScanner() {
    if (cooldownTimerRef.current) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }

    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      await scanner.clear();
    } catch {
      // The browser can already release the camera during page changes.
    }
  }

  async function submitCheckin(uniqueCode: string) {
    if (!uniqueCode || cooldownRef.current || busyRef.current) return;

    cooldownRef.current = true;
    busyRef.current = true;
    setBusy(true);
    try {
      scannerRef.current?.pause(true);
    } catch {
      // Some browsers may already pause the video stream internally.
    }
    setResult({ message: "체크인 처리 중..." });

    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uniqueCode, challengeId }),
      });
      const data = (await response.json()) as CheckinResult;
      setResult(data);
    } catch {
      setResult({ error: "체크인 서버에 연결하지 못했습니다." });
    } finally {
      busyRef.current = false;
      setBusy(false);
      cooldownTimerRef.current = window.setTimeout(() => {
        cooldownRef.current = false;
        cooldownTimerRef.current = null;

        try {
          if (scannerRef.current?.isScanning) {
            scannerRef.current.resume();
          }
        } catch {
          // The scanner may already be stopped by the user.
        }
      }, 3000);
    }
  }

  async function startContinuousScan() {
    if (!challengeId || scannerRef.current) return;

    setResult(null);
    setRunning(true);
    setBusy(false);
    busyRef.current = false;
    cooldownRef.current = false;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader", false);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          void submitCheckin(decodedText.trim());
        },
        undefined,
      );
    } catch (error) {
      await stopScanner();
      setRunning(false);
      setResult({
        error:
          error instanceof Error
            ? error.message
            : "카메라를 시작하지 못했습니다. 브라우저 권한을 확인해 주세요.",
      });
    }
  }

  async function stopContinuousScan() {
    setRunning(false);
    setBusy(false);
    busyRef.current = false;
    cooldownRef.current = false;
    setResult(null);
    await stopScanner();
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
          시작 버튼을 누르면 바로 카메라 권한 팝업이 뜹니다. 카메라가 켜진
          뒤에는 QR을 스캔할 때마다 자동으로 체크인하고, 잠시 후 다음 QR을 받을
          준비를 합니다.
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

        <section style={styles.scannerWrap}>
          <div id="qr-reader" style={styles.reader}>
            {!running && (
              <p style={styles.placeholder}>
                연속 스캔 시작 버튼을 누르면 카메라가 켜집니다.
              </p>
            )}
          </div>
          {running && (
            <p style={styles.status}>
              {busy ? "체크인 처리 중..." : "다음 QR을 스캔할 준비가 됐습니다."}
            </p>
          )}
        </section>

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
  reader: {
    width: "100%",
    minHeight: 260,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    background: "#ffffff",
  },
  placeholder: {
    margin: 0,
    padding: 20,
    color: "#64748b",
    textAlign: "center",
    fontWeight: 700,
  },
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
