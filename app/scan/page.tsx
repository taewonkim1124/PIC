"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Html5Qrcode } from "html5-qrcode";

import { pick, useLanguage } from "@/app/useLanguage";

type CameraMode = "environment" | "user";

type CheckinResult = {
  status?: "checked_in" | "already_checked_in";
  participantName?: string;
  date?: string;
  message?: string;
  error?: string;
};

const copy = {
  ko: {
    eyebrow: "PIC 체크인",
    title: "QR 연속 체크인",
    description:
      "기본은 후면 카메라입니다. iPad에서 전면 카메라가 켜지면 아래 카메라 선택에서 후면 카메라로 바꿔 주세요.",
    challengeLabel: "챌린지 이름",
    cameraLabel: "카메라",
    rearCamera: "후면 카메라",
    frontCamera: "전면 카메라",
    loadingChallenges: "챌린지 목록 불러오는 중...",
    noChallenges: "등록된 챌린지가 없습니다",
    start: "연속 스캔 시작",
    stop: "연속 스캔 중지",
    switching: "카메라 전환 중...",
    switchCamera: "전면/후면 전환",
    changingChallenge: "챌린지 변경 중...",
    placeholder: "연속 스캔 시작 버튼을 누르면 카메라가 켜집니다.",
    processing: "체크인 처리 중...",
    ready: "다음 QR을 스캔할 준비가 됐습니다.",
    failed: "체크인 실패",
    cameraFailed: "카메라를 시작하지 못했습니다. 브라우저 권한을 확인해 주세요.",
    switchFailed: "카메라를 전환하지 못했습니다.",
    challengeLoadFailed: "챌린지 목록을 불러오지 못했습니다.",
    serverFailed: "체크인 서버에 연결하지 못했습니다.",
  },
  en: {
    eyebrow: "PIC Check-in",
    title: "Continuous QR Check-in",
    description:
      "The rear camera is selected by default. If your iPad opens the front camera, switch it below.",
    challengeLabel: "Challenge Name",
    cameraLabel: "Camera",
    rearCamera: "Rear Camera",
    frontCamera: "Front Camera",
    loadingChallenges: "Loading challenges...",
    noChallenges: "No challenges found",
    start: "Start Continuous Scan",
    stop: "Stop Continuous Scan",
    switching: "Switching camera...",
    switchCamera: "Switch Front/Rear",
    changingChallenge: "Changing challenge...",
    placeholder: "Press start to turn on the camera.",
    processing: "Processing check-in...",
    ready: "Ready to scan the next QR.",
    failed: "Check-in Failed",
    cameraFailed: "Could not start the camera. Please check browser permission.",
    switchFailed: "Could not switch camera.",
    challengeLoadFailed: "Could not load challenges.",
    serverFailed: "Could not connect to the check-in server.",
  },
} as const;

export default function ScanPage() {
  const { language } = useLanguage();
  const t = pick(language, copy);
  const cameraLabels: Record<CameraMode, string> = {
    environment: t.rearCamera,
    user: t.frontCamera,
  };

  const [challenges, setChallenges] = useState<string[]>([]);
  const [challengeId, setChallengeId] = useState("");
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [challengeError, setChallengeError] = useState("");
  const [cameraMode, setCameraMode] = useState<CameraMode>("environment");
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const challengeIdRef = useRef("");
  const cooldownRef = useRef(false);
  const cooldownTimerRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    challengeIdRef.current = challengeId;
  }, [challengeId]);

  useEffect(() => {
    mountedRef.current = true;

    async function loadChallenges() {
      try {
        const response = await fetch("/api/challenges", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        const names = data.challenges as string[];
        setChallenges(names);
        const firstChallenge = names[0] ?? "";
        challengeIdRef.current = firstChallenge;
        setChallengeId(firstChallenge);
      } catch (error) {
        setChallengeError(
          error instanceof Error ? error.message : t.challengeLoadFailed,
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
  }, [t.challengeLoadFailed]);

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

    const activeChallengeId = challengeIdRef.current;
    if (!activeChallengeId) return;

    cooldownRef.current = true;
    busyRef.current = true;
    setBusy(true);

    try {
      scannerRef.current?.pause(true);
    } catch {
      // Some browsers may already pause the video stream internally.
    }

    setResult({ message: t.processing });

    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uniqueCode, challengeId: activeChallengeId }),
      });
      const data = (await response.json()) as CheckinResult;
      setResult({
        ...data,
        message:
          data.status === "already_checked_in"
            ? language === "ko"
              ? `${data.participantName ?? "멤버"}님은 오늘 이미 참여했습니다.`
              : `${data.participantName ?? "Member"} already checked in today.`
            : data.status === "checked_in"
              ? language === "ko"
                ? `${data.participantName ?? "멤버"}님 체크인이 완료되었습니다.`
                : `${data.participantName ?? "Member"} checked in successfully.`
              : data.message,
      });
    } catch {
      setResult({ error: t.serverFailed });
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
      }, 2000);
    }
  }

  async function startScanner(mode: CameraMode) {
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader", false);
    scannerRef.current = scanner;

    await scanner.start(
      { facingMode: mode },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        void submitCheckin(decodedText.trim());
      },
      undefined,
    );
  }

  async function startContinuousScan() {
    if (!challengeId || scannerRef.current) return;

    setResult(null);
    setRunning(true);
    setBusy(false);
    busyRef.current = false;
    cooldownRef.current = false;

    try {
      await startScanner(cameraMode);
    } catch (error) {
      await stopScanner();
      setRunning(false);
      setResult({
        error: error instanceof Error ? error.message : t.cameraFailed,
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

  async function switchCamera(nextMode: CameraMode) {
    if (nextMode === cameraMode || switchingCamera) return;

    setSwitchingCamera(true);
    setCameraMode(nextMode);
    setResult(null);
    busyRef.current = false;
    cooldownRef.current = false;

    try {
      const shouldRestart = running;
      await stopScanner();
      if (shouldRestart && mountedRef.current) {
        await startScanner(nextMode);
      }
    } catch (error) {
      setRunning(false);
      setResult({
        error: error instanceof Error ? error.message : t.switchFailed,
      });
    } finally {
      setSwitchingCamera(false);
    }
  }

  async function switchToNextCamera() {
    await switchCamera(cameraMode === "environment" ? "user" : "environment");
  }

  async function changeChallenge(nextChallengeId: string) {
    challengeIdRef.current = nextChallengeId;
    setChallengeId(nextChallengeId);
    setResult(null);

    if (!running || switchingCamera) return;

    setSwitchingCamera(true);
    setBusy(false);
    busyRef.current = false;
    cooldownRef.current = false;

    try {
      await stopScanner();
      if (mountedRef.current && nextChallengeId) {
        await startScanner(cameraMode);
      }
    } catch (error) {
      setRunning(false);
      setResult({
        error: error instanceof Error ? error.message : t.cameraFailed,
      });
    } finally {
      setSwitchingCamera(false);
    }
  }

  const resultStyle =
    result?.error || result?.status === "already_checked_in"
      ? styles.warningResult
      : styles.successResult;

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>{t.eyebrow}</p>
        <h1 style={styles.title}>{t.title}</h1>
        <p style={styles.description}>{t.description}</p>

        <label style={styles.label}>
          {t.challengeLabel}
          <select
            value={challengeId}
            onChange={(event) => void changeChallenge(event.target.value)}
            disabled={loadingChallenges || switchingCamera}
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

        <label style={styles.label}>
          {t.cameraLabel}
          <select
            value={cameraMode}
            onChange={(event) => void switchCamera(event.target.value as CameraMode)}
            disabled={switchingCamera}
            style={styles.input}
          >
            <option value="environment">{cameraLabels.environment}</option>
            <option value="user">{cameraLabels.user}</option>
          </select>
        </label>

        {challengeError && <p style={styles.error}>{challengeError}</p>}

        {!running ? (
          <button
            disabled={!challengeId || switchingCamera}
            onClick={startContinuousScan}
            style={styles.button}
          >
            {t.start}
          </button>
        ) : (
          <div style={styles.buttonGrid}>
            <button
              onClick={stopContinuousScan}
              disabled={switchingCamera}
              style={styles.secondaryButton}
            >
              {t.stop}
            </button>
            <button
              onClick={() => void switchToNextCamera()}
              disabled={switchingCamera}
              style={styles.secondaryButton}
            >
              {switchingCamera ? t.switching : t.switchCamera}
            </button>
          </div>
        )}

        <section style={styles.scannerWrap}>
          <div id="qr-reader" style={styles.reader} />
          {!running && <p style={styles.placeholder}>{t.placeholder}</p>}
          {running && (
            <p style={styles.status}>
              {switchingCamera ? t.changingChallenge : busy ? t.processing : t.ready}
            </p>
          )}
        </section>

        {result && (
          <section style={resultStyle}>
            <h2 style={styles.resultTitle}>
              {result.participantName ?? (result.error ? t.failed : t.processing)}
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
  label: {
    display: "grid",
    gap: 7,
    marginTop: 14,
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
  buttonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 18,
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
