"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Html5QrcodeScanner } from "html5-qrcode";

type ScanResult = {
  participantName?: string;
  uniqueCode?: string;
  error?: string;
};

type PaymentResult = {
  status?: "paid";
  participantName?: string;
  uniqueCode?: string;
  amount?: number;
  item?: string;
  message?: string;
  error?: string;
};

export default function PaymentPage() {
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const handlingScan = useRef(false);

  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;

    async function startScanner() {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5QrcodeScanner(
        "payment-qr-reader",
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
        setPaymentResult(null);
        setScanResult({ uniqueCode: decodedText });
      }, undefined);
    }

    void startScanner();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) void scanner.clear().catch(() => undefined);
    };
  }, [scanning]);

  function startScan() {
    handlingScan.current = false;
    setScanResult(null);
    setPaymentResult(null);
    setScanning(true);
  }

  function resetForNextPayment() {
    handlingScan.current = false;
    setItem("");
    setAmount("");
    setScanResult(null);
    setPaymentResult(null);
    setScanning(false);
  }

  async function savePayment() {
    if (!scanResult?.uniqueCode) return;

    setSaving(true);
    setPaymentResult(null);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uniqueCode: scanResult.uniqueCode,
          item,
          amount,
        }),
      });
      const data = (await response.json()) as PaymentResult;

      if (!response.ok) {
        setPaymentResult(data);
        return;
      }

      setScanResult({
        uniqueCode: data.uniqueCode,
        participantName: data.participantName,
      });
      setPaymentResult(data);
    } catch {
      setPaymentResult({ error: "결제 서버에 연결하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    !!scanResult?.uniqueCode && item.trim() && Number(amount) > 0 && !saving;

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>PIC 장부</p>
        <h1 style={styles.title}>QR 결제 기록</h1>
        <p style={styles.description}>
          먼저 멤버 QR을 스캔한 다음, 아이템과 가격을 입력해서 Notion Payments
          장부에 저장합니다.
        </p>

        {!scanning && !scanResult && !paymentResult && (
          <button onClick={startScan} style={styles.button}>
            QR 먼저 스캔하기
          </button>
        )}

        {scanning && <div id="payment-qr-reader" style={styles.reader} />}

        {scanResult?.uniqueCode && (
          <section style={styles.scannedBox}>
            <p style={styles.smallTitle}>스캔 완료</p>
            <h2 style={styles.resultTitle}>
              {scanResult.participantName ?? "멤버 QR을 확인했습니다"}
            </h2>
            <p style={styles.resultText}>{scanResult.uniqueCode}</p>
          </section>
        )}

        {scanResult?.uniqueCode && paymentResult?.status !== "paid" && (
          <div style={styles.form}>
            <label style={styles.label}>
              아이템 *
              <input
                value={item}
                onChange={(event) => setItem(event.target.value)}
                style={styles.input}
                placeholder="예: 회비, 티셔츠, 행사비"
              />
            </label>

            <label style={styles.label}>
              가격 *
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                style={styles.input}
                placeholder="예: 20"
              />
            </label>

            <button disabled={!canSave} onClick={savePayment} style={styles.button}>
              {saving ? "저장 중..." : "장부에 저장"}
            </button>

            <button onClick={startScan} style={styles.secondaryButton}>
              다른 QR 다시 스캔
            </button>
          </div>
        )}

        {paymentResult && (
          <section style={paymentResult.error ? styles.errorBox : styles.resultBox}>
            <h2 style={styles.resultTitle}>
              {paymentResult.participantName ?? "결제 기록 실패"}
            </h2>
            {paymentResult.status === "paid" ? (
              <p style={styles.resultText}>
                {paymentResult.uniqueCode} / {paymentResult.item} / $
                {paymentResult.amount}
              </p>
            ) : null}
            <p style={styles.resultText}>{paymentResult.message ?? paymentResult.error}</p>
            {paymentResult.status === "paid" && (
              <button onClick={resetForNextPayment} style={styles.button}>
                다음 결제 기록
              </button>
            )}
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
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginTop: 18,
  },
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
  reader: { width: "100%", marginTop: 18, background: "#fff" },
  scannedBox: {
    marginTop: 18,
    padding: 18,
    borderRadius: 14,
    background: "#e0f2fe",
    color: "#075985",
  },
  resultBox: {
    marginTop: 18,
    padding: 18,
    borderRadius: 14,
    background: "#dcfce7",
    color: "#166534",
  },
  errorBox: {
    marginTop: 18,
    padding: 18,
    borderRadius: 14,
    background: "#fee2e2",
    color: "#991b1b",
  },
  smallTitle: { margin: "0 0 6px", fontSize: 13, fontWeight: 800 },
  resultTitle: { margin: "0 0 8px", fontSize: 22 },
  resultText: { margin: "0 0 12px", lineHeight: 1.5 },
};
