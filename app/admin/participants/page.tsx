"use client";

import { FormEvent, useState } from "react";
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
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function registerParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setParticipant(null);
    setQrImage("");

    try {
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "멤버 등록에 실패했습니다.");
      }

      const createdParticipant = result.participant as Participant;
      setParticipant(createdParticipant);
      setQrImage(await QRCode.toDataURL(createdParticipant.unique_code, { width: 320 }));
      setName("");
      setEmail("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "멤버 등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <h1>멤버 등록</h1>
        <form onSubmit={registerParticipant} style={styles.form}>
          <label>
            이름
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={styles.input}
            />
          </label>
          <label>
            이메일 (선택)
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={styles.input}
            />
          </label>
          <button disabled={loading} style={styles.button}>
            {loading ? "등록 중..." : "멤버 등록"}
          </button>
        </form>
        {message && <p style={styles.error}>{message}</p>}
      </section>

      {participant && (
        <section style={{ ...styles.card, textAlign: "center" }}>
          <h2>{participant.name}</h2>
          <p style={styles.code}>{participant.unique_code}</p>
          {/* A generated data URL is the intended source for this QR image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImage} alt={`${participant.name}님의 QR 코드`} width={320} />
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 680, margin: "40px auto", padding: 20, display: "grid", gap: 24 },
  card: { border: "1px solid #ddd", borderRadius: 12, padding: 24, background: "#fff", color: "#111" },
  form: { display: "grid", gap: 16 },
  input: { display: "block", width: "100%", marginTop: 6, padding: 10, border: "1px solid #bbb", borderRadius: 6 },
  button: { padding: 12, border: 0, borderRadius: 6, background: "#111", color: "#fff", cursor: "pointer" },
  error: { color: "#b42318" },
  code: { fontFamily: "monospace", fontSize: 18 },
};
