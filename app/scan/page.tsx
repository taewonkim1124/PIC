"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5QrcodeScanner } from "html5-qrcode";

const DEFAULT_CHALLENGE_ID = "Default Challenge";
const DEFAULT_MANAGER = "";

type CheckinResult = {
  status?: "checked_in" | "already_checked_in";
  participantName?: string;
  date?: string;
  message?: string;
  error?: string;
};

export default function ScanPage() {
  const [challengeId, setChallengeId] = useState(DEFAULT_CHALLENGE_ID);
  const [manager, setManager] = useState(DEFAULT_MANAGER);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const handlingScan = useRef(false);

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
            body: JSON.stringify({ uniqueCode: decodedText, challengeId, manager }),
          });
          const data = (await response.json()) as CheckinResult;
          setResult(data);
        } catch {
          setResult({ error: "Could not contact the check-in server." });
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
  }, [challengeId, manager, scanning]);

  function scanAgain() {
    handlingScan.current = false;
    setResult(null);
    setScanning(true);
  }

  return (
    <main style={styles.main}>
      <h1>Scan QR check-in</h1>
      <label>
        Challenge name
        <input
          value={challengeId}
          onChange={(event) => setChallengeId(event.target.value)}
          disabled={scanning}
          placeholder="Default Challenge"
          style={styles.input}
        />
      </label>
      <label>
        Manager
        <input
          value={manager}
          onChange={(event) => setManager(event.target.value)}
          disabled={scanning}
          placeholder="Manager name"
          style={styles.input}
        />
      </label>

      {!scanning && !result && (
        <button disabled={!challengeId.trim()} onClick={scanAgain} style={styles.button}>
          Start camera
        </button>
      )}

      {scanning && <div id="qr-reader" style={styles.reader} />}

      {result && (
        <section style={styles.result}>
          <h2>{result.participantName ?? "Check-in failed"}</h2>
          {result.date && <p>{result.date}</p>}
          <p>{result.message ?? result.error}</p>
          <button onClick={scanAgain} style={styles.button}>Scan again</button>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 680, margin: "40px auto", padding: 20, display: "grid", gap: 20 },
  input: { display: "block", width: "100%", marginTop: 6, padding: 10, border: "1px solid #bbb", borderRadius: 6 },
  button: { padding: 12, border: 0, borderRadius: 6, background: "#111", color: "#fff", cursor: "pointer" },
  reader: { width: "100%", background: "#fff" },
  result: { border: "1px solid #ddd", borderRadius: 12, padding: 24, background: "#fff", color: "#111" },
};
