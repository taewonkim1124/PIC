"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Html5Qrcode } from "html5-qrcode";

import { pick, useLanguage } from "@/app/useLanguage";

type ScanResult = {
  participantName?: string;
  uniqueCode?: string;
  error?: string;
};

type PaymentResult = {
  status?: "paid";
  participantName?: string;
  amount?: number;
  item?: string;
  message?: string;
  error?: string;
};

const copy = {
  ko: {
    eyebrow: "PIC 장부",
    title: "QR 결제 기록",
    description:
      "먼저 멤버 QR을 한 번 스캔한 다음, 아이템과 가격을 입력해서 Notion Payments 장부에 저장합니다.",
    startScan: "QR 먼저 스캔하기",
    scanning: "QR을 한 번 스캔하면 자동으로 카메라가 꺼집니다.",
    scanned: "스캔 완료",
    memberFound: "멤버 QR을 확인했습니다",
    item: "아이템 *",
    itemPlaceholder: "예: 회비, 티셔츠, 행사비",
    price: "가격 *",
    pricePlaceholder: "예: 20",
    saving: "저장 중...",
    save: "장부에 저장",
    scanAgain: "다른 QR 다시 스캔",
    nextPayment: "다음 결제 기록",
    failed: "결제 기록 실패",
    cameraFailed: "카메라를 시작하지 못했습니다. 브라우저 권한을 확인해 주세요.",
    serverFailed: "결제 서버에 연결하지 못했습니다.",
    paid: "결제 기록이 저장되었습니다.",
  },
  en: {
    eyebrow: "PIC Ledger",
    title: "QR Payment Record",
    description:
      "Scan a member QR once, then enter the item and price to save it to the Notion Payments ledger.",
    startScan: "Scan QR First",
    scanning: "The camera will turn off automatically after one QR scan.",
    scanned: "Scan Complete",
    memberFound: "Member QR confirmed",
    item: "Item *",
    itemPlaceholder: "e.g. Dues, T-shirt, Event fee",
    price: "Price *",
    pricePlaceholder: "e.g. 20",
    saving: "Saving...",
    save: "Save to Ledger",
    scanAgain: "Scan Different QR",
    nextPayment: "Next Payment",
    failed: "Payment Save Failed",
    cameraFailed: "Could not start the camera. Please check browser permission.",
    serverFailed: "Could not connect to the payment server.",
    paid: "Payment record saved.",
  },
} as const;

export default function PaymentPage() {
  const { language } = useLanguage();
  const t = pick(language, copy);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingScan = useRef(false);

  async function stopScanner() {
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

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  async function startScan() {
    if (scannerRef.current) return;

    handlingScan.current = false;
    setScanResult(null);
    setPaymentResult(null);
    setScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("payment-qr-reader", false);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (handlingScan.current) return;

          handlingScan.current = true;
          await stopScanner();
          setScanning(false);
          setPaymentResult(null);
          setScanResult({ uniqueCode: decodedText.trim() });
        },
        undefined,
      );
    } catch (error) {
      await stopScanner();
      setScanning(false);
      setPaymentResult({
        error: error instanceof Error ? error.message : t.cameraFailed,
      });
    }
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
        uniqueCode: scanResult.uniqueCode,
        participantName: data.participantName,
      });
      setPaymentResult({
        ...data,
        message:
          language === "ko"
            ? `${data.participantName ?? "멤버"}님의 ${data.item} 결제 기록이 저장되었습니다.`
            : `${data.item} payment saved for ${data.participantName ?? "member"}.`,
      });
    } catch {
      setPaymentResult({ error: t.serverFailed });
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    !!scanResult?.uniqueCode && item.trim() && Number(amount) > 0 && !saving;

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>{t.eyebrow}</p>
        <h1 style={styles.title}>{t.title}</h1>
        <p style={styles.description}>{t.description}</p>

        {!scanning && !scanResult && !paymentResult && (
          <button onClick={startScan} style={styles.button}>
            {t.startScan}
          </button>
        )}

        {scanning && (
          <section style={styles.scannerWrap}>
            <div id="payment-qr-reader" style={styles.reader} />
            <p style={styles.status}>{t.scanning}</p>
          </section>
        )}

        {scanResult?.uniqueCode && (
          <section style={styles.scannedBox}>
            <p style={styles.smallTitle}>{t.scanned}</p>
            <h2 style={styles.resultTitle}>
              {scanResult.participantName ?? t.memberFound}
            </h2>
            <p style={styles.resultText}>{t.memberFound}</p>
          </section>
        )}

        {scanResult?.uniqueCode && paymentResult?.status !== "paid" && (
          <div style={styles.form}>
            <label style={styles.label}>
              {t.item}
              <input
                value={item}
                onChange={(event) => setItem(event.target.value)}
                style={styles.input}
                placeholder={t.itemPlaceholder}
              />
            </label>

            <label style={styles.label}>
              {t.price}
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                style={styles.input}
                placeholder={t.pricePlaceholder}
              />
            </label>

            <button disabled={!canSave} onClick={savePayment} style={styles.button}>
              {saving ? t.saving : t.save}
            </button>

            <button onClick={startScan} style={styles.secondaryButton}>
              {t.scanAgain}
            </button>
          </div>
        )}

        {paymentResult && (
          <section style={paymentResult.error ? styles.errorBox : styles.resultBox}>
            <h2 style={styles.resultTitle}>
              {paymentResult.participantName ?? t.failed}
            </h2>
            {paymentResult.status === "paid" ? (
              <p style={styles.resultText}>
                {paymentResult.item} / ${paymentResult.amount}
              </p>
            ) : null}
            <p style={styles.resultText}>
              {paymentResult.message ?? paymentResult.error ?? t.paid}
            </p>
            {paymentResult.status === "paid" && (
              <button onClick={resetForNextPayment} style={styles.button}>
                {t.nextPayment}
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
  scannerWrap: { marginTop: 18 },
  reader: {
    width: "100%",
    minHeight: 260,
    overflow: "hidden",
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    background: "#ffffff",
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
