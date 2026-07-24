"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { pick, useLanguage } from "@/app/useLanguage";

type Participant = {
  id: string;
  name: string;
  email: string | null;
  has_qr: boolean;
  masked_code: string;
};

const copy = {
  ko: {
    eyebrow: "PIC 관리자",
    title: "멤버 QR 관리",
    description:
      "멤버 등록은 Google Form으로 받고, 이 페이지에서는 기존 멤버의 QR 조회, 발급, 재발급, 이메일 발송을 관리합니다.",
    noticeLoadFailed: "멤버 목록을 불러올 수 없습니다.",
    qrIssueFailed: "QR 코드를 발급할 수 없습니다.",
    qrEmailFailed: "QR 이메일을 보낼 수 없습니다.",
    reissueConfirm:
      "님의 기존 QR 코드를 새 QR 코드로 재발급할까요?\n\n재발급 후에는 기존 QR을 사용할 수 없습니다. 새 QR은 이메일로 자동 발송됩니다.",
    reissuedAndEmailed: "님의 QR 코드를 재발급하고 이메일로 보냈습니다.",
    issued: "님의 QR 코드 발급이 완료되었습니다.",
    bulkIssued: "명의 미발급 멤버에게 QR 코드를 발급했습니다.",
    bulkIssuedEmail: "명의 미발급 멤버에게 QR 코드를 발급하고 이메일을 보냈습니다.",
    emailed: "님에게 QR 이메일을 보냈습니다.",
    sectionTitle: "기존 멤버 QR 관리",
    sectionDescription: "이름, 이메일, 고유코드로 멤버를 검색할 수 있습니다.",
    searchPlaceholder: "멤버 이름 검색",
    help:
      "QR이 없는 멤버는 새로 발급할 수 있고, 이미 QR이 있는 멤버는 재발급할 수 있습니다. 재발급한 QR은 이메일로 자동 발송됩니다.",
    issueAll: "미발급 멤버 전체 발급",
    issueAllEmail: "미발급 전체 발급 + 이메일",
    refresh: "새로고침",
    loading: "멤버 목록을 불러오는 중...",
    noName: "이름 없음",
    noEmail: "이메일 없음",
    notIssued: "QR 미발급",
    qrTitle: "QR 코드",
    noQrYet: "아직 QR 코드가 발급되지 않았습니다.",
    showQr: "QR 보기",
    issueQr: "QR 발급",
    reissueEmail: "재발급 + 이메일",
    sendEmail: "이메일 발송",
    noResults: "검색 결과가 없습니다.",
  },
  en: {
    eyebrow: "PIC Admin",
    title: "Member QR Management",
    description:
      "Member registration comes from Google Form. Use this page to view, issue, reissue, and email QR codes for existing members.",
    noticeLoadFailed: "Could not load members.",
    qrIssueFailed: "Could not issue QR code.",
    qrEmailFailed: "Could not send QR email.",
    reissueConfirm:
      "'s existing QR code will be replaced with a new QR code.\n\nThe old QR will no longer work. The new QR will be emailed automatically.",
    reissuedAndEmailed: "'s QR code was reissued and emailed.",
    issued: "'s QR code was issued.",
    bulkIssued: " members were issued QR codes.",
    bulkIssuedEmail: " members were issued QR codes and emailed.",
    emailed: " was sent a QR email.",
    sectionTitle: "Existing Member QR Management",
    sectionDescription: "Search members by name, email, or unique code.",
    searchPlaceholder: "Search member name",
    help:
      "Members without QR codes can be issued new codes. Members with QR codes can be reissued, and reissued QR codes are emailed automatically.",
    issueAll: "Issue Missing QR Codes",
    issueAllEmail: "Issue Missing + Email",
    refresh: "Refresh",
    loading: "Loading members...",
    noName: "No name",
    noEmail: "No email",
    notIssued: "QR not issued",
    qrTitle: "QR Code",
    noQrYet: "QR code has not been issued yet.",
    showQr: "Show QR",
    issueQr: "Issue QR",
    reissueEmail: "Reissue + Email",
    sendEmail: "Send Email",
    noResults: "No search results.",
  },
} as const;

export default function ParticipantsAdminPage() {
  const { language } = useLanguage();
  const t = pick(language, copy);
  const noticeLoadFailed = t.noticeLoadFailed;
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const filteredParticipants = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return participants;

    return participants.filter((participant) => {
      const fields = [
        participant.name,
        participant.email ?? "",
        participant.masked_code,
      ];

      return fields.some((field) =>
        field.toLocaleLowerCase().includes(keyword),
      );
    });
  }, [participants, search]);

  async function showQr(participant: Participant) {
    setSelectedParticipantId(participant.id);
    setQrImage("");

    if (!participant.has_qr) return;

    const params = new URLSearchParams({ participantId: participant.id });
    const response = await fetch(`/api/participants/qr-image?${params}`, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? t.qrIssueFailed);
    }
    setQrImage(result.qrImage);
  }

  function hideQr() {
    setSelectedParticipantId("");
    setQrImage("");
  }

  async function handleShowQr(participant: Participant) {
    setMessage("");

    try {
      await showQr(participant);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.qrIssueFailed);
    }
  }

  async function loadParticipants() {
    setListLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/participants", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? noticeLoadFailed);
      }

      setParticipants(result.participants);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : noticeLoadFailed);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadParticipants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function issueQr(participant: Participant, reissue = false) {
    if (reissue && !window.confirm(`${participant.name}${t.reissueConfirm}`)) {
      return;
    }

    setLoading(true);
    setMessage("");
    hideQr();

    try {
      const response = await fetch("/api/participants/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          reissue,
          sendEmail: reissue,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? t.qrIssueFailed);
      }

      const updatedParticipant = result.participant as Participant;
      await loadParticipants();
      await showQr(updatedParticipant);
      setMessage(
        reissue
          ? `${updatedParticipant.name}${t.reissuedAndEmailed}`
          : `${updatedParticipant.name}${t.issued}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.qrIssueFailed);
    } finally {
      setLoading(false);
    }
  }

  async function issueMissingQr(sendEmail = false) {
    setLoading(true);
    setMessage("");
    hideQr();

    try {
      const response = await fetch("/api/participants/qr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? t.qrIssueFailed);
      }

      await loadParticipants();
      setMessage(
        sendEmail
          ? `${result.count}${t.bulkIssuedEmail}`
          : `${result.count}${t.bulkIssued}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.qrIssueFailed);
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
        throw new Error(result.error ?? t.qrEmailFailed);
      }

      setMessage(`${participant.name}${t.emailed}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.qrEmailFailed);
    } finally {
      setLoading(false);
    }
  }

    const missingQrCount = participants.filter(
    (participant) => !participant.has_qr,
  ).length;

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>{t.eyebrow}</p>
        <h1 style={styles.title}>{t.title}</h1>
        <p style={styles.description}>{t.description}</p>
        {message && <p style={styles.notice}>{message}</p>}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>{t.sectionTitle}</h2>
        <p style={styles.muted}>{t.sectionDescription}</p>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.searchPlaceholder}
          style={styles.searchInput}
        />
        <p style={styles.muted}>{t.help}</p>

        <div style={styles.actions}>
          <button
            disabled={loading || missingQrCount === 0}
            onClick={() => issueMissingQr(false)}
            style={styles.button}
          >
            {t.issueAll} ({missingQrCount})
          </button>
          <button
            disabled={loading || missingQrCount === 0}
            onClick={() => issueMissingQr(true)}
            style={styles.secondaryButton}
          >
            {t.issueAllEmail}
          </button>
          <button
            disabled={listLoading}
            onClick={loadParticipants}
            style={styles.secondaryButton}
          >
            {t.refresh}
          </button>
        </div>

        {listLoading ? (
          <p>{t.loading}</p>
        ) : (
          <div style={styles.table}>
            {filteredParticipants.map((participant) => {
              const isSelected = selectedParticipantId === participant.id;

              return (
                <article key={participant.id} style={styles.memberRow}>
                  <div style={styles.memberInfo}>
                    <strong>{participant.name || t.noName}</strong>
                    <p style={styles.muted}>{participant.email ?? t.noEmail}</p>
                    <p style={styles.code}>
                      {participant.masked_code || t.notIssued}
                    </p>

                    {isSelected && (
                      <div style={styles.inlineQr}>
                        <h3 style={styles.inlineQrTitle}>
                          {participant.name} {t.qrTitle}
                        </h3>
                        {qrImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrImage}
                            alt={`${participant.name} ${t.qrTitle}`}
                            width={260}
                          />
                        ) : (
                          <p>{t.noQrYet}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={styles.rowActions}>
                    <button
                      disabled={loading || !participant.has_qr}
                      onClick={() => handleShowQr(participant)}
                      style={styles.smallButton}
                    >
                      {t.showQr}
                    </button>
                    {!participant.has_qr && (
                      <button
                        disabled={loading}
                        onClick={() => issueQr(participant)}
                        style={styles.smallButton}
                      >
                        {t.issueQr}
                      </button>
                    )}
                    {participant.has_qr && (
                      <button
                        disabled={loading || !participant.email}
                        onClick={() => issueQr(participant, true)}
                        style={styles.smallDangerButton}
                      >
                        {t.reissueEmail}
                      </button>
                    )}
                    <button
                      disabled={loading || !participant.email || !participant.has_qr}
                      onClick={() => emailQr(participant)}
                      style={styles.smallButton}
                    >
                      {t.sendEmail}
                    </button>
                  </div>
                </article>
              );
            })}
            {filteredParticipants.length === 0 && <p>{t.noResults}</p>}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    maxWidth: 980,
    margin: "40px auto",
    padding: 20,
    display: "grid",
    gap: 24,
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 24,
    background: "#fff",
    color: "#111",
  },
  eyebrow: {
    margin: 0,
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 1.5,
  },
  title: { margin: "8px 0", fontSize: 32, lineHeight: 1.2 },
  sectionTitle: { margin: "0 0 8px", fontSize: 24 },
  description: { margin: 0, color: "#64748b", lineHeight: 1.6 },
  searchInput: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    margin: "12px 0",
    padding: 12,
    border: "1px solid #999",
    borderRadius: 8,
  },
  button: {
    padding: 12,
    border: 0,
    borderRadius: 6,
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: 12,
    border: "1px solid #bbb",
    borderRadius: 6,
    background: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  notice: {
    marginTop: 14,
    color: "#075985",
    background: "#e0f2fe",
    padding: 12,
    borderRadius: 8,
  },
  muted: { color: "#666", margin: "4px 0" },
  code: { fontFamily: "monospace", fontSize: 14, margin: "4px 0" },
  actions: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 },
  table: { display: "grid", gap: 10 },
  memberRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "start",
    border: "1px solid #eee",
    borderRadius: 10,
    padding: 14,
  },
  memberInfo: { display: "grid", gap: 4 },
  rowActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  smallButton: {
    padding: "8px 10px",
    border: "1px solid #bbb",
    borderRadius: 6,
    background: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  smallDangerButton: {
    padding: "8px 10px",
    border: "1px solid #fca5a5",
    borderRadius: 6,
    background: "#fff1f2",
    color: "#9f1239",
    cursor: "pointer",
  },
  inlineQr: {
    marginTop: 12,
    padding: 12,
    width: "fit-content",
    border: "1px solid #eee",
    borderRadius: 8,
    textAlign: "center",
    background: "#fafafa",
  },
  inlineQrTitle: { margin: "0 0 8px" },
};
