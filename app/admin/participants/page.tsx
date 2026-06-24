"use client";

import { FormEvent, useEffect, useState } from "react";
import QRCode from "qrcode";

type Participant = {
  id: string;
  name: string;
  email: string | null;
  unique_code: string;
};

export default function ParticipantsAdminPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sendOnRegister, setSendOnRegister] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    void loadParticipants();
  }, []);

  async function showQr(participant: Participant) {
    setSelectedParticipant(participant);
    setQrImage(
      participant.unique_code
        ? await QRCode.toDataURL(participant.unique_code, { width: 320 })
        : "",
    );
  }

  async function loadParticipants() {
    setListLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/participants", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "멤버 목록을 불러올 수 없습니다.");
      }

      setParticipants(result.participants);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "멤버 목록을 불러올 수 없습니다.");
    } finally {
      setListLoading(false);
    }
  }

  async function registerParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSelectedParticipant(null);
    setQrImage("");

    try {
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, sendEmail: sendOnRegister }),
      });
      const result = await response.json();

      if (!response.ok) {
        if (result.participant) await showQr(result.participant);
        throw new Error(result.error ?? "멤버 등록에 실패했습니다.");
      }

      const createdParticipant = result.participant as Participant;
      await showQr(createdParticipant);
      setName("");
      setEmail("");
      setSendOnRegister(false);
      await loadParticipants();
      setMessage(
        result.emailSent
          ? "멤버 등록과 QR 이메일 발송이 완료되었습니다."
          : "멤버 등록이 완료되었습니다.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "멤버 등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function issueQr(
    participant: Participant,
    options?: { reissue?: boolean; sendEmail?: boolean },
  ) {
    const isReissue = options?.reissue === true;

    if (isReissue && !window.confirm(`${participant.name}님의 기존 QR 코드를 새 QR 코드로 재발급할까요? 기존 QR은 더 이상 사용할 수 없습니다.`)) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/participants/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          reissue: isReissue,
          sendEmail: options?.sendEmail ?? false,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "QR 코드를 발급할 수 없습니다.");
      }

      const updatedParticipant = result.participant as Participant;
      await showQr(updatedParticipant);
      await loadParticipants();
      setMessage(
        result.emailSent
          ? "QR 코드 발급과 이메일 발송이 완료되었습니다."
          : isReissue
            ? "기존 QR 코드를 새 QR 코드로 재발급했습니다."
            : "QR 코드 발급이 완료되었습니다.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR 코드를 발급할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function issueMissingQr(sendEmail: boolean) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/participants/qr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "미발급 멤버 QR 코드를 발급할 수 없습니다.");
      }

      await loadParticipants();
      setMessage(`${result.count}명의 기존 멤버에게 QR 코드를 새로 발급했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "미발급 멤버 QR 코드를 발급할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function emailQr(participant: Participant) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/participants/email-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: participant.id }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "QR 이메일을 보낼 수 없습니다.");
      }

      setMessage(`${participant.name}님에게 QR 이메일을 보냈습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR 이메일을 보낼 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }

  const missingQrCount = participants.filter((participant) => !participant.unique_code).length;

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <h1>멤버 등록</h1>
        <form onSubmit={registerParticipant} style={styles.form}>
          <label>
            이름
            <input required value={name} onChange={(event) => setName(event.target.value)} style={styles.input} />
          </label>
          <label>
            이메일
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={styles.input} />
          </label>
          <label style={styles.checkboxLabel}>
            <input type="checkbox" checked={sendOnRegister} onChange={(event) => setSendOnRegister(event.target.checked)} />
            등록 후 QR 이메일 보내기
          </label>
          <button disabled={loading} style={styles.button}>
            {loading ? "처리 중..." : "멤버 등록"}
          </button>
        </form>
        {message && <p style={styles.notice}>{message}</p>}
      </section>

      <section style={styles.card}>
        <h2>기존 멤버 QR 관리</h2>
        <p style={styles.muted}>
          QR이 없는 기존 멤버에게는 새 QR을 발급하고, 이미 QR이 있는 멤버는 재발급으로 기존 코드를 새 코드로 교체합니다.
        </p>
        <div style={styles.actions}>
          <button disabled={loading || missingQrCount === 0} onClick={() => issueMissingQr(false)} style={styles.button}>
            미발급 멤버 전체 발급 ({missingQrCount})
          </button>
          <button disabled={loading || missingQrCount === 0} onClick={() => issueMissingQr(true)} style={styles.secondaryButton}>
            미발급 전체 발급 + 이메일
          </button>
          <button disabled={listLoading} onClick={loadParticipants} style={styles.secondaryButton}>
            새로고침
          </button>
        </div>

        {listLoading ? (
          <p>멤버 목록을 불러오는 중...</p>
        ) : (
          <div style={styles.table}>
            {participants.map((participant) => (
              <article key={participant.id} style={styles.memberRow}>
                <div>
                  <strong>{participant.name || "이름 없음"}</strong>
                  <p style={styles.muted}>{participant.email ?? "이메일 없음"}</p>
                  <p style={styles.code}>{participant.unique_code || "QR 미발급"}</p>
                </div>
                <div style={styles.rowActions}>
                  <button disabled={loading || !participant.unique_code} onClick={() => showQr(participant)} style={styles.smallButton}>
                    QR 보기
                  </button>
                  {!participant.unique_code && (
                    <button disabled={loading} onClick={() => issueQr(participant)} style={styles.smallButton}>
                      QR 발급
                    </button>
                  )}
                  {participant.unique_code && (
                    <button disabled={loading} onClick={() => issueQr(participant, { reissue: true })} style={styles.smallDangerButton}>
                      재발급
                    </button>
                  )}
                  <button disabled={loading || !participant.email || !participant.unique_code} onClick={() => emailQr(participant)} style={styles.smallButton}>
                    이메일 발송
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedParticipant && (
        <section style={{ ...styles.card, textAlign: "center" }}>
          <h2>{selectedParticipant.name}</h2>
          <p style={styles.code}>{selectedParticipant.unique_code || "QR 미발급"}</p>
          {qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImage} alt={`${selectedParticipant.name}님의 QR 코드`} width={320} />
          ) : (
            <p>아직 QR 코드가 발급되지 않았습니다.</p>
          )}
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 980, margin: "40px auto", padding: 20, display: "grid", gap: 24 },
  card: { border: "1px solid #ddd", borderRadius: 12, padding: 24, background: "#fff", color: "#111" },
  form: { display: "grid", gap: 16 },
  input: { display: "block", width: "100%", marginTop: 6, padding: 10, border: "1px solid #bbb", borderRadius: 6 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8 },
  button: { padding: 12, border: 0, borderRadius: 6, background: "#111", color: "#fff", cursor: "pointer" },
  secondaryButton: { padding: 12, border: "1px solid #bbb", borderRadius: 6, background: "#fff", color: "#111", cursor: "pointer" },
  notice: { color: "#075985", background: "#e0f2fe", padding: 12, borderRadius: 8 },
  muted: { color: "#666", margin: "4px 0" },
  code: { fontFamily: "monospace", fontSize: 14, margin: "4px 0" },
  actions: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 },
  table: { display: "grid", gap: 10 },
  memberRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 14, alignItems: "center", border: "1px solid #eee", borderRadius: 10, padding: 14 },
  rowActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  smallButton: { padding: "8px 10px", border: "1px solid #bbb", borderRadius: 6, background: "#fff", color: "#111", cursor: "pointer" },
  smallDangerButton: { padding: "8px 10px", border: "1px solid #fca5a5", borderRadius: 6, background: "#fff1f2", color: "#9f1239", cursor: "pointer" },
};
